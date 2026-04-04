import { eq, and, sql } from "drizzle-orm";
import {
  users,
  savedRoutes,
  preferences,
  passwordResetTokens,
  runHistory,
  type User,
  type InsertUser,
  type Route,
  type RoutePreferences,
  type PasswordResetToken,
  type RunHistoryEntry,
  type InsertRunHistory,
} from "@shared/schema";
import { getDb } from "./db";

// -- Interface --------------------------------------------------------------

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getRoute(id: number): Promise<Route | undefined>;
  getRoutes(): Promise<Route[]>;
  getRoutesByPoints(startPoint: string, endPoint: string): Promise<Route[]>;
  saveRoute(route: Route): Promise<Route>;
  deleteRoute(id: number, userId: number): Promise<void>;
  getRoutesByUserId(userId: number): Promise<Route[]>;

  savePreferences(prefs: Partial<RoutePreferences>): Promise<RoutePreferences>;
  getPreferences(userId?: number): Promise<RoutePreferences | undefined>;

  saveRunHistory(entry: InsertRunHistory): Promise<RunHistoryEntry>;
  getRunHistoryByUserId(userId: number): Promise<RunHistoryEntry[]>;
  getUserAveragePace(userId: number): Promise<number | null>;

  createPasswordResetToken(userId: number, token: string, expiresAt: Date): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(token: string): Promise<void>;
  updateUserPassword(userId: number, hashedPassword: string): Promise<void>;
}

// -- In-memory fallback -----------------------------------------------------

export class MemStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private routes: Map<number, Route> = new Map();
  private preferences: Map<number, RoutePreferences> = new Map();
  private resetTokens: Map<string, PasswordResetToken> = new Map();
  private runHistoryEntries: Map<number, RunHistoryEntry> = new Map();
  private routeId = 1;
  private preferenceId = 1;
  private resetTokenId = 1;
  private runHistoryId = 1;
  currentId = 1;

  async getUser(id: number) {
    return this.users.get(id);
  }

  async getUserByUsername(username: string) {
    return Array.from(this.users.values()).find((u) => u.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { ...insertUser, id, createdAt: new Date() };
    this.users.set(id, user);
    return user;
  }

  async getRoute(id: number) {
    return this.routes.get(id);
  }
  async getRoutes() {
    return Array.from(this.routes.values());
  }
  async getRoutesByPoints(startPoint: string, endPoint: string) {
    return Array.from(this.routes.values()).filter((r) => {
      const rs = `${r.startPoint.lat},${r.startPoint.lng}`;
      const re = `${r.endPoint.lat},${r.endPoint.lng}`;
      return (
        (rs.includes(startPoint) || startPoint.includes(rs)) &&
        (re.includes(endPoint) || endPoint.includes(re))
      );
    });
  }
  async saveRoute(route: Route): Promise<Route> {
    if (route.id && this.routes.has(route.id)) {
      this.routes.set(route.id, route);
      return route;
    }
    const id = this.routeId++;
    const newRoute = { ...route, id };
    this.routes.set(id, newRoute);
    return newRoute;
  }

  async deleteRoute(id: number, userId: number): Promise<void> {
    const route = this.routes.get(id);
    if (route && (route as any).userId === userId) {
      this.routes.delete(id);
    }
  }

  async getRoutesByUserId(userId: number): Promise<Route[]> {
    return Array.from(this.routes.values()).filter((r: any) => r.userId === userId);
  }

  async savePreferences(prefs: Partial<RoutePreferences>): Promise<RoutePreferences> {
    if (this.preferences.has(1)) {
      const existing = this.preferences.get(1)!;
      const updated = { ...existing, ...prefs };
      this.preferences.set(1, updated);
      return updated;
    }
    const id = this.preferenceId++;
    const newPrefs = { id, ...prefs } as RoutePreferences;
    this.preferences.set(id, newPrefs);
    return newPrefs;
  }

  async getPreferences() {
    return this.preferences.get(1);
  }

  async saveRunHistory(entry: InsertRunHistory): Promise<RunHistoryEntry> {
    const id = this.runHistoryId++;
    const newEntry: RunHistoryEntry = { ...entry, id, completedAt: new Date() };
    this.runHistoryEntries.set(id, newEntry);
    return newEntry;
  }

  async getRunHistoryByUserId(userId: number): Promise<RunHistoryEntry[]> {
    return Array.from(this.runHistoryEntries.values())
      .filter((e) => e.userId === userId)
      .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));
  }

  async getUserAveragePace(userId: number): Promise<number | null> {
    const runs = await this.getRunHistoryByUserId(userId);
    const withPace = runs.filter((r) => r.paceMinPerKm != null && r.distanceKm >= 0.5);
    if (withPace.length === 0) return null;
    // Weight recent runs more: use exponential decay
    let weightedSum = 0;
    let weightTotal = 0;
    for (let i = 0; i < withPace.length; i++) {
      const weight = Math.exp(-0.3 * i); // most recent first
      weightedSum += withPace[i].paceMinPerKm! * weight;
      weightTotal += weight;
    }
    return weightedSum / weightTotal;
  }

  async createPasswordResetToken(userId: number, token: string, expiresAt: Date): Promise<PasswordResetToken> {
    const id = this.resetTokenId++;
    const entry: PasswordResetToken = { id, userId, token, expiresAt, usedAt: null, createdAt: new Date() };
    this.resetTokens.set(token, entry);
    return entry;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    return this.resetTokens.get(token);
  }

  async markPasswordResetTokenUsed(token: string): Promise<void> {
    const entry = this.resetTokens.get(token);
    if (entry) {
      entry.usedAt = new Date();
    }
  }

  async updateUserPassword(userId: number, hashedPassword: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.password = hashedPassword;
    }
  }
}

// -- Database-backed storage ------------------------------------------------

export class DatabaseStorage implements IStorage {
  private db: NonNullable<ReturnType<typeof getDb>>;

  constructor(db: NonNullable<ReturnType<typeof getDb>>) {
    this.db = db;
    this.ensurePasswordResetTable();
  }

  private async ensurePasswordResetTable() {
    try {
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          token VARCHAR(255) NOT NULL UNIQUE,
          expires_at TIMESTAMP NOT NULL,
          used_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
    } catch (err) {
      console.error("Failed to ensure password_reset_tokens table:", err);
    }
  }

  async getUser(id: number) {
    const rows = await this.db.select().from(users).where(eq(users.id, id));
    return rows[0];
  }

  async getUserByUsername(username: string) {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return rows[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const rows = await this.db.insert(users).values(insertUser).returning();
    return rows[0];
  }

  async getRoute(id: number): Promise<Route | undefined> {
    const rows = await this.db
      .select()
      .from(savedRoutes)
      .where(eq(savedRoutes.id, id));
    return rows[0] ? this.mapSavedRouteToRoute(rows[0]) : undefined;
  }

  async getRoutes(): Promise<Route[]> {
    const rows = await this.db.select().from(savedRoutes);
    return rows.map((r) => this.mapSavedRouteToRoute(r));
  }

  async getRoutesByPoints(startPoint: string, endPoint: string): Promise<Route[]> {
    const all = await this.getRoutes();
    return all.filter((r) => {
      const rs = `${r.startPoint.lat},${r.startPoint.lng}`;
      const re = `${r.endPoint.lat},${r.endPoint.lng}`;
      return (
        (rs.includes(startPoint) || startPoint.includes(rs)) &&
        (re.includes(endPoint) || endPoint.includes(re))
      );
    });
  }

  async saveRoute(route: Route): Promise<Route> {
    const rows = await this.db
      .insert(savedRoutes)
      .values({
        userId: route.userId,
        name: route.name,
        description: route.description,
        startPoint: route.startPoint,
        endPoint: route.endPoint,
        distance: route.distance,
        elevationGain: route.elevationGain,
        estimatedTime: route.estimatedTime,
        routePath: route.routePath,
        routeType: route.routeType,
        surfaceType: route.surfaceType,
        sceneryRating: route.sceneryRating,
        trafficLevel: route.trafficLevel,
        features: route.features,
        directions: route.directions,
      })
      .returning();
    return this.mapSavedRouteToRoute(rows[0]);
  }

  async deleteRoute(id: number, userId: number): Promise<void> {
    await this.db
      .delete(savedRoutes)
      .where(
        and(eq(savedRoutes.id, id), eq(savedRoutes.userId, userId))
      );
  }

  async getRoutesByUserId(userId: number): Promise<Route[]> {
    const rows = await this.db
      .select()
      .from(savedRoutes)
      .where(eq(savedRoutes.userId, userId));
    return rows.map((r) => this.mapSavedRouteToRoute(r));
  }

  async savePreferences(prefs: Partial<RoutePreferences>): Promise<RoutePreferences> {
    // Upsert for the default user (userId = null for anonymous)
    const existing = await this.db
      .select()
      .from(preferences)
      .limit(1);

    if (existing.length > 0) {
      const rows = await this.db
        .update(preferences)
        .set({
          minDistance: prefs.minDistance,
          maxDistance: prefs.maxDistance,
          sceneryPreference: prefs.sceneryPreference,
          trafficPreference: prefs.trafficPreference,
          routeType: prefs.routeType,
          updatedAt: new Date(),
        })
        .where(eq(preferences.id, existing[0].id))
        .returning();
      return this.mapPrefs(rows[0]);
    }

    const rows = await this.db
      .insert(preferences)
      .values({
        minDistance: prefs.minDistance,
        maxDistance: prefs.maxDistance,
        sceneryPreference: prefs.sceneryPreference,
        trafficPreference: prefs.trafficPreference,
        routeType: prefs.routeType,
      })
      .returning();
    return this.mapPrefs(rows[0]);
  }

  async getPreferences(): Promise<RoutePreferences | undefined> {
    const rows = await this.db.select().from(preferences).limit(1);
    return rows[0] ? this.mapPrefs(rows[0]) : undefined;
  }

  async saveRunHistory(entry: InsertRunHistory): Promise<RunHistoryEntry> {
    try {
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS run_history (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          route_id INTEGER,
          distance_km DOUBLE PRECISION NOT NULL,
          duration_seconds DOUBLE PRECISION NOT NULL,
          pace_min_per_km DOUBLE PRECISION,
          completed_at TIMESTAMP DEFAULT NOW()
        )
      `);
    } catch {}
    const rows = await this.db
      .insert(runHistory)
      .values(entry)
      .returning();
    return rows[0];
  }

  async getRunHistoryByUserId(userId: number): Promise<RunHistoryEntry[]> {
    try {
      const rows = await this.db
        .select()
        .from(runHistory)
        .where(eq(runHistory.userId, userId));
      return rows.sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));
    } catch {
      return [];
    }
  }

  async getUserAveragePace(userId: number): Promise<number | null> {
    const runs = await this.getRunHistoryByUserId(userId);
    const withPace = runs.filter((r) => r.paceMinPerKm != null && r.distanceKm >= 0.5);
    if (withPace.length === 0) return null;
    let weightedSum = 0;
    let weightTotal = 0;
    for (let i = 0; i < withPace.length; i++) {
      const weight = Math.exp(-0.3 * i);
      weightedSum += withPace[i].paceMinPerKm! * weight;
      weightTotal += weight;
    }
    return weightedSum / weightTotal;
  }

  async createPasswordResetToken(userId: number, token: string, expiresAt: Date): Promise<PasswordResetToken> {
    const rows = await this.db
      .insert(passwordResetTokens)
      .values({ userId, token, expiresAt })
      .returning();
    return rows[0];
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const rows = await this.db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
    return rows[0];
  }

  async markPasswordResetTokenUsed(token: string): Promise<void> {
    await this.db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.token, token));
  }

  async updateUserPassword(userId: number, hashedPassword: string): Promise<void> {
    await this.db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, userId));
  }

  private mapSavedRouteToRoute(r: typeof savedRoutes.$inferSelect): Route {
    return {
      id: r.id,
      userId: r.userId ?? undefined,
      name: r.name,
      description: r.description ?? undefined,
      startPoint: r.startPoint as { lat: number; lng: number },
      endPoint: r.endPoint as { lat: number; lng: number },
      distance: r.distance,
      elevationGain: r.elevationGain ?? undefined,
      estimatedTime: r.estimatedTime ?? undefined,
      routePath: r.routePath,
      routeType: r.routeType ?? undefined,
      surfaceType: (r.surfaceType as Route['surfaceType']) ?? undefined,
      sceneryRating: r.sceneryRating ?? undefined,
      trafficLevel: r.trafficLevel ?? undefined,
      features: (r.features as string[]) ?? undefined,
      directions: r.directions as Route["directions"],
    };
  }

  private mapPrefs(r: typeof preferences.$inferSelect): RoutePreferences {
    return {
      id: r.id,
      minDistance: r.minDistance ?? undefined,
      maxDistance: r.maxDistance ?? undefined,
      sceneryPreference: r.sceneryPreference ?? undefined,
      trafficPreference: r.trafficPreference ?? undefined,
      routeType: r.routeType ?? undefined,
    };
  }
}

// -- Initialise: use DB if available, otherwise in-memory -------------------

function createStorage(): IStorage {
  const db = getDb();
  if (db) {
    console.log("Using PostgreSQL database for storage");
    return new DatabaseStorage(db);
  }
  console.log("DATABASE_URL not set -- using in-memory storage (data will not persist across restarts)");
  return new MemStorage();
}

export const storage = createStorage();

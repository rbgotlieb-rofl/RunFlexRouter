import { 
  users, 
  type User, 
  type InsertUser, 
  type Route, 
  type RoutePreferences,
  type InsertRoutePreferences
} from "@shared/schema";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Route methods
  getRoute(id: number): Promise<Route | undefined>;
  getRoutes(): Promise<Route[]>;
  getRoutesByPoints(startPoint: string, endPoint: string): Promise<Route[]>;
  saveRoute(route: Route): Promise<Route>;
  
  // Preferences methods
  savePreferences(preferences: Partial<RoutePreferences>): Promise<RoutePreferences>;
  getPreferences(userId?: number): Promise<RoutePreferences | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private routes: Map<number, Route>;
  private preferences: Map<number, RoutePreferences>;
  private routeId: number;
  private preferenceId: number;
  currentId: number;

  constructor() {
    this.users = new Map();
    this.routes = new Map();
    this.preferences = new Map();
    this.currentId = 1;
    this.routeId = 1;
    this.preferenceId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // Route methods
  async getRoute(id: number): Promise<Route | undefined> {
    return this.routes.get(id);
  }
  
  async getRoutes(): Promise<Route[]> {
    return Array.from(this.routes.values());
  }
  
  async getRoutesByPoints(startPoint: string, endPoint: string): Promise<Route[]> {
    // Convert the routes to an array
    const allRoutes = Array.from(this.routes.values());
    
    // Filter routes by matching start and end points
    // We'll do a simple string comparison for the MVP
    return allRoutes.filter(route => {
      const routeStart = `${route.startPoint.lat},${route.startPoint.lng}`;
      const routeEnd = `${route.endPoint.lat},${route.endPoint.lng}`;
      
      // Check if route matches the requested points
      // We're being a bit loose with the comparison to handle different string formats
      const matchesStart = routeStart.includes(startPoint) || startPoint.includes(routeStart);
      const matchesEnd = routeEnd.includes(endPoint) || endPoint.includes(routeEnd);
      
      return matchesStart && matchesEnd;
    });
  }
  
  async saveRoute(route: Route): Promise<Route> {
    // If the route has an ID, update it. Otherwise, create a new one.
    if (route.id && this.routes.has(route.id)) {
      this.routes.set(route.id, route);
      return route;
    } else {
      const id = this.routeId++;
      const newRoute = { ...route, id };
      this.routes.set(id, newRoute);
      return newRoute;
    }
  }
  
  // Preferences methods
  async savePreferences(preferences: Partial<RoutePreferences>): Promise<RoutePreferences> {
    // In this MVP version, we're just storing a single preferences object
    // In a real app, we'd use the userId to determine which preferences to update
    
    // If there's already a preferences object with ID 1, update it
    if (this.preferences.has(1)) {
      const existingPrefs = this.preferences.get(1)!;
      const updatedPrefs = { ...existingPrefs, ...preferences };
      this.preferences.set(1, updatedPrefs);
      return updatedPrefs;
    } else {
      // Otherwise, create a new one
      const id = this.preferenceId++;
      const newPrefs = { 
        id, 
        ...preferences
      } as RoutePreferences;
      this.preferences.set(id, newPrefs);
      return newPrefs;
    }
  }
  
  async getPreferences(userId?: number): Promise<RoutePreferences | undefined> {
    // In this MVP, we'll just return the first preferences object if it exists
    return this.preferences.get(1);
  }
}

export const storage = new MemStorage();

import session from "express-session";
import { neon } from "@neondatabase/serverless";

/**
 * Simple PostgreSQL session store using Neon's serverless HTTP driver.
 * Stores sessions in the existing "session" table.
 */
export class NeonSessionStore extends session.Store {
  private sql: ReturnType<typeof neon>;

  constructor(connectionString: string) {
    super();
    this.sql = neon(connectionString);
  }

  async get(sid: string, callback: (err?: any, session?: session.SessionData | null) => void) {
    try {
      const rows = await this.sql`
        SELECT sess FROM session WHERE sid = ${sid} AND expire > NOW()
      `;
      if (rows.length === 0) return callback(null, null);
      const sess = typeof rows[0].sess === "string" ? JSON.parse(rows[0].sess) : rows[0].sess;
      callback(null, sess);
    } catch (err) {
      callback(err);
    }
  }

  async set(sid: string, sessionData: session.SessionData, callback?: (err?: any) => void) {
    try {
      const expire = sessionData.cookie?.expires
        ? new Date(sessionData.cookie.expires)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const sess = JSON.stringify(sessionData);
      await this.sql`
        INSERT INTO session (sid, sess, expire)
        VALUES (${sid}, ${sess}::json, ${expire.toISOString()}::timestamp)
        ON CONFLICT (sid) DO UPDATE SET sess = ${sess}::json, expire = ${expire.toISOString()}::timestamp
      `;
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  async destroy(sid: string, callback?: (err?: any) => void) {
    try {
      await this.sql`DELETE FROM session WHERE sid = ${sid}`;
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  async touch(sid: string, sessionData: session.SessionData, callback?: (err?: any) => void) {
    try {
      const expire = sessionData.cookie?.expires
        ? new Date(sessionData.cookie.expires)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await this.sql`
        UPDATE session SET expire = ${expire.toISOString()}::timestamp WHERE sid = ${sid}
      `;
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }
}

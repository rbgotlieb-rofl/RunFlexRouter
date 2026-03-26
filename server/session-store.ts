import session from "express-session";
import { neon } from "@neondatabase/serverless";

/**
 * PostgreSQL session store using Neon's serverless HTTP driver.
 * Stores sessions in the existing "session" table.
 */
export class NeonSessionStore extends session.Store {
  private sql: ReturnType<typeof neon>;

  constructor(connectionString: string) {
    super();
    this.sql = neon(connectionString);
    console.log("NeonSessionStore: initialized");
  }

  get(sid: string, callback: (err?: any, session?: session.SessionData | null) => void) {
    this.sql`SELECT sess FROM session WHERE sid = ${sid} AND expire > NOW()`
      .then((rows) => {
        if (rows.length === 0) return callback(null, null);
        const sess = typeof rows[0].sess === "string" ? JSON.parse(rows[0].sess) : rows[0].sess;
        callback(null, sess);
      })
      .catch((err) => {
        console.error("NeonSessionStore.get error:", err.message);
        callback(err);
      });
  }

  set(sid: string, sessionData: session.SessionData, callback?: (err?: any) => void) {
    const maxAge = sessionData.cookie?.maxAge || 30 * 24 * 60 * 60 * 1000;
    const expireTime = new Date(Date.now() + maxAge);
    const sess = JSON.stringify(sessionData);

    this.sql`
      INSERT INTO session (sid, sess, expire)
      VALUES (${sid}, ${sess}::json, ${expireTime.toISOString()}::timestamp)
      ON CONFLICT (sid) DO UPDATE SET sess = ${sess}::json, expire = ${expireTime.toISOString()}::timestamp
    `
      .then(() => callback?.())
      .catch((err) => {
        console.error("NeonSessionStore.set error:", err.message);
        callback?.(err);
      });
  }

  destroy(sid: string, callback?: (err?: any) => void) {
    this.sql`DELETE FROM session WHERE sid = ${sid}`
      .then(() => callback?.())
      .catch((err) => {
        console.error("NeonSessionStore.destroy error:", err.message);
        callback?.(err);
      });
  }

  touch(sid: string, sessionData: session.SessionData, callback?: (err?: any) => void) {
    const maxAge = sessionData.cookie?.maxAge || 30 * 24 * 60 * 60 * 1000;
    const expireTime = new Date(Date.now() + maxAge);

    this.sql`UPDATE session SET expire = ${expireTime.toISOString()}::timestamp WHERE sid = ${sid}`
      .then(() => callback?.())
      .catch((err) => {
        console.error("NeonSessionStore.touch error:", err.message);
        callback?.(err);
      });
  }
}

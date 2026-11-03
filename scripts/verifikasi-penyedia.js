
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function verifikasiPenyedia(
  pool,
  email,
  status = "terverifikasi",
) {
  if (
    !["terverifikasi", "ditolak"].includes(status) ||
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    email.trim().length > 254
  ) {
    throw new Error("Email atau status peninjauan tidak valid.");
  }

  const c = await pool.connect();
  let mulai = false;
  let rusak;

  try {
    await c.query("BEGIN");
    mulai = true;

    await c.query("SET LOCAL lock_timeout = '2s'");

    const hasil = await c.query(
      `SELECT py.id, u.email
       FROM penyedia py
       JOIN pengguna u ON u.id = py.pengguna_id
       WHERE u.email = $1
         AND u.peran = 'penyedia'
         AND u.aktif = TRUE
       FOR UPDATE OF py, u`,
      [email.trim().toLowerCase()],
    );

    if (hasil.rows.length !== 1) {
      throw new Error("Akun penyedia aktif tidak ditemukan.");
    }

    await c.query(
      `UPDATE penyedia
       SET status_verifikasi = $1
       WHERE id = $2`,
      [status, hasil.rows[0].id],
    );

    await c.query("COMMIT");
    mulai = false;

    return {
      email: hasil.rows[0].email,
      status,
    };
  } catch (error) {
    if (mulai) {
      try {
        await c.query("ROLLBACK");
      } catch (errorRollback) {
        rusak = errorRollback;
      }
    }

    throw error;
  } finally {
    c.release(rusak);
  }
}

const fileSaatIni = process.argv[1]
  ? resolve(process.argv[1])
  : null;

if (
  fileSaatIni &&
  fileSaatIni === fileURLToPath(import.meta.url)
) {
  let pool;

  try {
    const cloud = process.argv.includes("--cloud");

    const tujuan = cloud
      ? (
          process.env.CLOUD_CONFIRM_DATABASE ??
          process.env.DEMO_CONFIRM_DATABASE
        )
      : "sisabaik_dev";

    if (cloud) {
      if (
        !(process.env.PGHOST ?? "").endsWith(".neon.tech") ||
        process.env.PGSSL !== "require" ||
        !tujuan
      ) {
        throw new Error(
          "Peninjauan cloud memerlukan Neon/TLS dan CLOUD_CONFIRM_DATABASE.",
        );
      }
    } else if (
      !["localhost", "127.0.0.1"].includes(process.env.PGHOST) ||
      process.env.PGDATABASE !== tujuan
    ) {
      throw new Error(
        "Peninjauan lokal hanya untuk sisabaik_dev.",
      );
    }

    const args = process.argv
      .slice(2)
      .filter((arg) => !["--cloud", "--tolak"].includes(arg));

    if (args.length !== 1) {
      throw new Error(
        "Gunakan: npm run penyedia:verifikasi -- email@domain.com [--tolak]",
      );
    }

    ({ pool } = await import("../src/db/pool.js"));

    const db = await pool.query(
      `SELECT
         current_database() AS nama,
         (
           SELECT ssl
           FROM pg_stat_ssl
           WHERE pid = pg_backend_pid()
         ) AS tls`,
    );

    if (
      db.rows[0].nama !== tujuan ||
      (cloud && db.rows[0].tls !== true)
    ) {
      throw new Error("Database tujuan atau TLS tidak sesuai.");
    }

    const hasil = await verifikasiPenyedia(
      pool,
      args[0],
      process.argv.includes("--tolak")
        ? "ditolak"
        : "terverifikasi",
    );

    console.log(
      `Status penyedia ${hasil.email}: ${hasil.status}. ` +
      "Pengguna dapat menekan Periksa status.",
    );
  } catch (error) {
    console.error(
      error.code
        ? `Peninjauan gagal: ${error.code}`
        : error.message,
    );

    process.exitCode = 1;
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

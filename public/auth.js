
"use strict";

const el = (id) => {
  const elemen = document.getElementById(id);

  if (!elemen) {
    throw new Error(`Elemen HTML dengan id="${id}" tidak ditemukan.`);
  }

  return elemen;
};

let token = null;
let pengguna = null;
let sibuk = false;

function tampilPesan(teks) {
  const pesan = document.getElementById("pesan");
  if (pesan) pesan.textContent = teks;
}

function tampilSesi() {
  const identitas = el("identitas");
  const login = el("login");
  const registrasi = el("registrasi");
  const logout = el("logout");

  identitas.textContent = pengguna
    ? `${pengguna.namaLengkap} (${pengguna.peran})`
    : "Belum login. Silakan login atau buat akun baru.";

  login.hidden = Boolean(pengguna);
  registrasi.hidden = Boolean(pengguna);
  logout.hidden = !pengguna;

  const penyedia = pengguna?.peran === "penyedia";
  const siapJual =
    penyedia && pengguna.statusVerifikasi === "terverifikasi";

  el("area-profil").hidden = !penyedia;
  el("area-penyedia").hidden = !siapJual;
  el("area-pesanan").hidden =
    !(pengguna?.peran === "pembeli" || siapJual);

  el("profil-usaha").textContent = penyedia
    ? `${pengguna.namaUsaha || "Usaha"} — ${pengguna.alamatUsaha || "Alamat belum tersedia"}`
    : "";

  el("status-usaha").textContent = penyedia
    ? `Status peninjauan: ${pengguna.statusVerifikasi || "belum diketahui"}.`
    : "";
}

function tampilFormUsaha() {
  const perlu = el("jenis-akun").value === "penyedia";
  const profil = el("profil-daftar");

  // Penting: aktifkan/nonaktifkan fieldset, bukan hanya input di dalamnya.
  profil.hidden = !perlu;
  profil.disabled = !perlu;

  profil.querySelectorAll("input").forEach((input) => {
    input.required = perlu;
  });
}

function hapusSesi() {
  token = null;
  pengguna = null;

  const pesanan = document.getElementById("pesanan");
  const milik = document.getElementById("milik");

  if (pesanan) pesanan.textContent = "";
  if (milik) milik.textContent = "";

  tampilSesi();
}

async function api(path, method = "GET", body, privat = true) {
  const headers = {
    Accept: "application/json",
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (privat && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : String(error);

    throw new Error(
      `Tidak dapat menghubungi server API (${path}). ` +
      "Pastikan backend berjalan, alamat dan port benar, " +
      `serta halaman dibuka melalui server. Detail: ${detail}`,
    );
  }

  if (response.status === 204) {
    if (!response.ok) {
      throw new Error(
        `Permintaan gagal dengan status HTTP ${response.status}.`,
      );
    }
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  let hasil;

  if (contentType.includes("application/json")) {
    try {
      hasil = await response.json();
    } catch {
      throw new Error("Server mengirim respons JSON yang tidak valid.");
    }
  } else {
    const teks = await response.text();

    hasil = {
      error: {
        message: teks || "Server tidak mengirim respons JSON.",
      },
    };
  }

  if (!response.ok) {
    if (response.status === 401 && privat) {
      hapusSesi();
    }

    const error = hasil?.error;
    const kode = error?.code;
    const pesan =
      error?.message || "Permintaan ke server gagal.";

    throw new Error(
      `HTTP ${response.status}${kode ? ` ${kode}` : ""}: ${pesan}`,
    );
  }

  return hasil;
}

async function kerjakan(aksi) {
  if (sibuk) return;

  sibuk = true;

  // Simpan kondisi awal agar tombol yang memang nonaktif
  // tidak diaktifkan secara tidak sengaja.
  const tombol = [...document.querySelectorAll("button")];
  const statusAwal = tombol.map((button) => button.disabled);

  tombol.forEach((button) => {
    button.disabled = true;
  });

  try {
    await aksi();
  } catch (error) {
    const pesan =
      error instanceof Error ? error.message : "Terjadi kesalahan.";

    tampilPesan(pesan);
    console.error(error);
  } finally {
    tombol.forEach((button, index) => {
      button.disabled = statusAwal[index];
    });

    sibuk = false;
  }
}

async function katalog() {
  const hasil = await api(
    "/api/penawaran?limit=50",
    "GET",
    undefined,
    false,
  );

  if (!Array.isArray(hasil?.data)) {
    throw new Error(
      "Format katalog tidak sesuai. Periksa respons GET /api/penawaran.",
    );
  }

  const tabel = el("katalog");
  tabel.replaceChildren();

  if (hasil.data.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");

    td.colSpan = 5;
    td.textContent = "Belum ada penawaran makanan yang tersedia.";

    tr.append(td);
    tabel.append(tr);
    return;
  }

  for (const p of hasil.data) {
    const tr = document.createElement("tr");

    for (const nilai of [
      p.id,
      p.nama,
      `Rp ${Number(p.hargaPenawaran).toLocaleString("id-ID")}`,
      `${p.stok} ${p.satuan}`,
    ]) {
      const td = document.createElement("td");
      td.textContent = String(nilai ?? "");
      tr.append(td);
    }

    const tdAksi = document.createElement("td");

    if (pengguna?.peran === "pembeli") {
      const tombol = document.createElement("button");
      tombol.type = "button";
      tombol.textContent = "Pesan 1 unit";

      tombol.addEventListener("click", () => {
        kerjakan(async () => {
          const hasilPesanan = await api("/api/pesanan", "POST", {
            items: [
              {
                penawaranId: p.id,
                kuantitas: 1,
              },
            ],
          });

          tampilPesan(
            `Pesanan ${hasilPesanan?.data?.id ?? "baru"} berhasil dibuat.`,
          );

          await katalog();
        });
      });

      tdAksi.append(tombol);
    } else if (!pengguna) {
      tdAksi.textContent = "Login sebagai pembeli untuk memesan.";
    } else {
      tdAksi.textContent = "Akun ini tidak dapat memesan.";
    }

    tr.append(tdAksi);
    tabel.append(tr);
  }
}

el("jenis-akun").addEventListener("change", tampilFormUsaha);

el("login").addEventListener("submit", (event) => {
  event.preventDefault();

  kerjakan(async () => {
    const email = el("email-login").value.trim();
    const kataSandi = el("sandi-login").value;

    const hasil = await api(
      "/api/auth/login",
      "POST",
      { email, kataSandi },
      false,
    );

    if (!hasil?.data?.accessToken) {
      throw new Error(
        "Token login tidak ditemukan. Periksa format respons endpoint login.",
      );
    }

    // Jangan menyimpan sesi setengah jadi jika pemuatan profil gagal.
    token = hasil.data.accessToken;

    try {
      const profil = await api("/api/auth/saya");

      if (!profil?.data?.id || !profil?.data?.peran) {
        throw new Error("Data profil pengguna dari server tidak lengkap.");
      }

      pengguna = profil.data;
    } catch (error) {
      hapusSesi();
      throw error;
    }

    el("sandi-login").value = "";

    tampilSesi();
    await katalog();

    tampilPesan(
      pengguna.peran === "penyedia" &&
      pengguna.statusVerifikasi !== "terverifikasi"
        ? "Login berhasil. Akun penyedia masih menunggu verifikasi."
        : "Login berhasil.",
    );
  });
});

el("registrasi").addEventListener("submit", (event) => {
  event.preventDefault();

  kerjakan(async () => {
    const kataSandi = el("sandi-daftar").value;
    const kataSandiUlang = el("sandi-ulang").value;

    if (
      [...kataSandi].length < 15 ||
      new TextEncoder().encode(kataSandi).length > 72
    ) {
      throw new Error(
        "Kata sandi minimal 15 karakter dan maksimal 72 byte UTF-8.",
      );
    }

    if (kataSandi !== kataSandiUlang) {
      throw new Error("Kedua kata sandi harus sama.");
    }

    const penyedia = el("jenis-akun").value === "penyedia";

    const data = {
      namaLengkap: el("nama-daftar").value.trim(),
      email: el("email-daftar").value.trim(),
      kataSandi,
    };

    if (penyedia) {
      data.namaUsaha = el("usaha-daftar").value.trim();
      data.alamat = el("alamat-daftar").value.trim();
      data.nomorTelepon = el("telepon-daftar").value.trim();

      if (
        !data.namaUsaha ||
        !data.alamat ||
        !data.nomorTelepon
      ) {
        throw new Error(
          "Lengkapi nama usaha, alamat, dan nomor telepon.",
        );
      }
    }

    const endpoint = penyedia
      ? "/api/auth/registrasi-penyedia"
      : "/api/auth/registrasi";

    await api(endpoint, "POST", data, false);

    const emailTerdaftar = data.email;

    // Bersihkan kata sandi dari variabel dan formulir setelah pendaftaran.
    data.kataSandi = "";
    el("sandi-daftar").value = "";
    el("sandi-ulang").value = "";

    el("registrasi").reset();
    tampilFormUsaha();

    el("email-login").value = emailTerdaftar;
    el("sandi-login").value = "";
    el("email-login").focus();

    tampilPesan(
      penyedia
        ? "Pendaftaran penyedia berhasil. Silakan login; izin berjualan menunggu verifikasi."
        : "Pendaftaran pembeli berhasil. Silakan login dengan email dan kata sandi yang dibuat.",
    );
  });
});

el("periksa-status").addEventListener("click", () => {
  kerjakan(async () => {
    const hasil = await api("/api/auth/saya");

    if (!hasil?.data) {
      throw new Error("Profil akun tidak ditemukan dalam respons server.");
    }

    pengguna = hasil.data;

    tampilSesi();
    await katalog();

    tampilPesan("Status akun berhasil diperbarui.");
  });
});

el("logout").addEventListener("click", () => {
  kerjakan(async () => {
    await api("/api/auth/logout", "POST", {});

    hapusSesi();
    await katalog();

    tampilPesan("Logout berhasil. Token sesi dihapus dari halaman.");
  });
});

el("penawaran").addEventListener("submit", (event) => {
  event.preventDefault();

  kerjakan(async () => {
    const tanggal = el("berakhir").value;
    const berakhirPada = new Date(tanggal);

    if (!tanggal || Number.isNaN(berakhirPada.getTime())) {
      throw new Error("Tanggal berakhir penawaran tidak valid.");
    }

    if (berakhirPada.getTime() <= Date.now()) {
      throw new Error("Waktu berakhir harus berada di masa depan.");
    }

    const payload = {
      nama: el("nama-produk").value.trim(),
      kategori: el("kategori").value.trim(),
      hargaNormal: Number(el("normal").value),
      hargaPenawaran: Number(el("hemat").value),
      stok: Number(el("stok").value),
      satuan: el("satuan").value.trim(),
      status: el("status").value,
      berakhirPada: berakhirPada.toISOString(),
    };

    if (
      !Number.isFinite(payload.hargaNormal) ||
      !Number.isFinite(payload.hargaPenawaran) ||
      !Number.isFinite(payload.stok) ||
      payload.hargaNormal < 1 ||
      payload.hargaPenawaran < 0 ||
      payload.stok < 0
    ) {
      throw new Error("Harga dan stok harus berupa angka yang valid.");
    }

    const hasil = await api("/api/penawaran", "POST", payload);

    tampilPesan(
      `Penawaran ${hasil?.data?.id ?? ""} berhasil dibuat.`,
    );

    el("penawaran").reset();
    await katalog();
  });
});

el("muat-katalog").addEventListener("click", () => {
  kerjakan(async () => {
    await katalog();
    tampilPesan("Katalog berhasil diperbarui.");
  });
});

el("muat-milik").addEventListener("click", () => {
  kerjakan(async () => {
    const hasil = await api("/api/penawaran/milik-saya?limit=50");

    el("milik").textContent = JSON.stringify(hasil, null, 2);
  });
});

el("muat-pesanan").addEventListener("click", () => {
  kerjakan(async () => {
    const hasil = await api("/api/pesanan?limit=50");

    el("pesanan").textContent = JSON.stringify(hasil, null, 2);
  });
});

// Inisialisasi halaman
tampilSesi();
tampilFormUsaha();

kerjakan(async () => {
  await katalog();
});

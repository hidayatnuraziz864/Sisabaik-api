
"use strict";

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#form-pesanan");

  if (form) {
    form.addEventListener("submit", kirimPesanan);
  }

  void muatPenawaran();
});

async function bacaRespons(respons) {
  const tipe = respons.headers.get("content-type") || "";

  if (tipe.includes("application/json")) {
    try {
      return await respons.json();
    } catch {
      throw new Error("Server mengirim JSON yang tidak valid.");
    }
  }

  const teks = await respons.text();

  return {
    error: {
      message: teks || "Server tidak memberikan respons JSON.",
    },
  };
}

async function muatPenawaran() {
  const status = document.querySelector("#status");
  const katalog = document.querySelector("#katalog");

  if (!status || !katalog) {
    console.error("Elemen #status atau #katalog tidak ditemukan.");
    return;
  }

  try {
    status.classList.remove("error");
    status.textContent = "Memuat data...";

    const respons = await fetch(
      "/api/penawaran?tersedia=true&limit=50",
      { headers: { Accept: "application/json" } },
    );

    const body = await bacaRespons(respons);

    if (!respons.ok) {
      throw new Error(
        body.error?.message || "Data penawaran gagal dimuat.",
      );
    }

    if (!Array.isArray(body.data)) {
      throw new Error("Format data penawaran tidak sesuai.");
    }

    katalog.replaceChildren(...body.data.map(buatKartu));

    const jumlah = body.meta?.jumlah ?? body.data.length;

    status.textContent =
      `${body.data.length} tampil dari ${jumlah} penawaran tersedia.`;
  } catch (error) {
    status.textContent = error.message || "Gagal memuat penawaran.";
    status.classList.add("error");
  }
}

function buatKartu(item) {
  const artikel = document.createElement("article");
  const judul = document.createElement("h3");
  const detail = document.createElement("p");

  judul.textContent = item.nama ?? "Penawaran tanpa nama";

  detail.textContent =
    `ID ${item.id}: stok ${item.stok} ${item.satuan}; ` +
    rupiah.format(Number(item.hargaPenawaran) || 0);

  artikel.append(judul, detail);

  return artikel;
}

async function kirimPesanan(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const tombol = form.querySelector('button[type="submit"], button');

  const status = document.querySelector("#status-pesanan");
  const hasil = document.querySelector("#hasil-pesanan");

  if (!status || !hasil || !tombol) {
    console.error("Elemen formulir pesanan tidak lengkap.");
    return;
  }

  if (!form.reportValidity()) {
    return;
  }

  const data = new FormData(form);
  const penawaranId = String(data.get("penawaranId") ?? "").trim();
  const kuantitas = Number(data.get("kuantitas"));

  if (!penawaranId) {
    status.textContent = "ID penawaran wajib diisi.";
    status.classList.add("error");
    return;
  }

  if (!Number.isSafeInteger(kuantitas) || kuantitas < 1) {
    status.textContent = "Kuantitas harus berupa bilangan bulat positif.";
    status.classList.add("error");
    return;
  }

  const payload = {
    emailPembeli: String(data.get("emailPembeli") ?? "").trim(),
    items: [
      {
        penawaranId,
        kuantitas,
      },
    ],
  };

  tombol.disabled = true;

  try {
    status.classList.remove("error");
    status.textContent = "Mengirim pesanan...";
    hasil.textContent = "";

    const respons = await fetch("/api/pesanan", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = await bacaRespons(respons);

    hasil.textContent = JSON.stringify(body, null, 2);

    if (!respons.ok) {
      throw new Error(
        body.error?.message || "Pesanan gagal dibuat.",
      );
    }

    status.textContent = body.data?.id
      ? `Pesanan ${body.data.id} dibuat; HTTP ${respons.status}.`
      : `Pesanan berhasil dikirim; HTTP ${respons.status}.`;

    form.reset();

    await muatPenawaran();
  } catch (error) {
    status.textContent = error.message || "Terjadi kesalahan saat membuat pesanan.";
    status.classList.add("error");
  } finally {
    tombol.disabled = false;
  }
}

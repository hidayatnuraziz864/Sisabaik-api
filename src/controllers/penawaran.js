import * as data from "../repositories/penawaran.js"; 
import { 
  idValid, 
  halamanValid, 
  filterValid, 
  penawaranValid, 
} from "../lib/api.js"; 
  
export async function daftar(req, res) { 
  const hasil = await data.daftarPenawaran( 
    filterValid(req.query), 
    halamanValid(req.query), 
  ); 
  return res.json({ success: true, ...hasil }); 
} 
export async function detail(req, res) { 
  const hasil = await data.bacaPenawaran(idValid(req.params.id)); 
  return res.json({ success: true, data: hasil }); 
} 
export async function buat(req, res) { 
  const hasil = await data.simpanPenawaran(penawaranValid(req.body)); 
  return res 
    .status(201) 
    .location(`/api/penawaran/${hasil.id}`) 
    .json({ success: true, data: hasil }); 
} 
export async function ubah(req, res) { 
  const hasil = await data.simpanPenawaran( 
    penawaranValid(req.body), 
    idValid(req.params.id), 
  ); 
  return res.json({ success: true, data: hasil }); 
} 
export async function hapus(req, res) { 
  await data.hapusPenawaran(idValid(req.params.id)); 
  return res.status(204).end(); 
} 

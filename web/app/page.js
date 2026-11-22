"use client";

import { useEffect } from "react";
import { MARKUP } from "../game/markup";

/* Halaman utama Negara Merdu: markup body index.html lama dirender apa
   adanya (DOM identik), lalu kode game (../game/main.js — pecahan app.js)
   dimuat di sisi klien sesudah DOM terpasang, persis peran
   <script src="app.js"> dulu. Game ini murni browser (Three.js,
   WebSocket, canvas) — tidak ada SSR untuknya. */
export default function Page() {
  useEffect(() => {
    import("../game/main.js");
  }, []);
  return (
    <div
      style={{ display: "contents" }}
      dangerouslySetInnerHTML={{ __html: MARKUP }}
    />
  );
}

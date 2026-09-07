// ═══════════════════════════════════════════════════════════
// 🔐 HOOK useAuth — FitTrack V2 (F1 · Acceso)
// Patrón RiderTrack V2 (useAuth) con el comportamiento del
// app viejo: al entrar sesión, cachea la cuenta en las claves
// FITTRACK_USER_* (idéntico al onAuthStateChanged del viejo),
// para que la UI pinte sin esperar a Firestore/Firebase.
// En F1 no hay onSnapshot de Firestore: el sync en la nube se
// decide en F2/F3 cuando existan vistas que escriban datos.
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import type { User as UsuarioFirebase } from 'firebase/auth';
import { onAuthChange } from '../services/firebase';
import { guardarUsuarioLocal, limpiarUsuarioLocal, leerUsuarioLocal } from '../services/storageFit';

export interface CuentaUsuario {
  uid: string;
  nombre: string;
  email: string;
  foto: string;
}

export function useAuth() {
  const [usuario, setUsuario] = useState<UsuarioFirebase | null>(null);
  const [cuenta, setCuenta] = useState<CuentaUsuario | null>(() => leerUsuarioLocal());
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const desuscribir = onAuthChange((u) => {
      setUsuario(u);
      setCargando(false);

      if (u) {
        // Igual que el viejo: displayName → 'Campeón' si Google no dio nombre
        const datos: CuentaUsuario = {
          uid: u.uid,
          nombre: u.displayName || 'Campeón',
          email: u.email || '',
          foto: u.photoURL || '',
        };
        guardarUsuarioLocal(datos);
        setCuenta(datos);
      } else {
        limpiarUsuarioLocal();
        setCuenta(null);
      }
    });
    return desuscribir;
  }, []);

  return { usuario, cuenta, cargando };
}

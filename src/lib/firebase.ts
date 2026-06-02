import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from "firebase/auth";
import appletConfig from "../../firebase-applet-config.json";

const firebaseConfig = {
  apiKey: "AIzaSyABh-CeZnb6HCOQeWonGUDnvldFX5rKzJY", // Fixed typo: '0' -> 'O'
  authDomain: "gen-lang-client-0493219468.firebaseapp.com",
  projectId: "gen-lang-client-0493219468",
  storageBucket: "gen-lang-client-0493219468.firebasestorage.app",
  messagingSenderId: "333075930756",
  appId: "1:333075930756:web:bafcc64a223b49a1ca6cd1"
};

// Se o app já estiver inicializado, usa o existente. Se não, inicializa.
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app, '(default)');
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { db, auth, googleProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut };
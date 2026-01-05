import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// DIQQAT: Pastdagi ma'lumotlarni o'zingizning Firebase-dagi ma'lumotlarga almashtiring
const firebaseConfig = {
  apiKey: "AIzaSyC51303VTgORagnnRxb_3tWuM0oZQgFH1c",
  authDomain: "ielts-app-telegram.firebaseapp.com",
  projectId: "ielts-app-telegram",
  storageBucket: "ielts-app-telegram.firebasestorage.app",
  messagingSenderId: "234918505504",
  appId: "1:234918505504:web:0fe97866a78a1d927e2045"
};

// Firebaseni ishga tushirish
const app = initializeApp(firebaseConfig);

// Bizga kerak bo'ladigan xizmatlarni eksport qilish
export const db = getFirestore(app);
export const auth = getAuth(app);
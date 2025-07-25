// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = JSON.parse(process.env.REACT_APP_FIREBASE_CONFIG);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };

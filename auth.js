// --- Firebase SDK Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyBxwM04W_3vHbXbNb7cvEXWUi3udRVXFXk",
    authDomain: "pico-iot-v1-2-9cf83.firebaseapp.com",
    projectId: "pico-iot-v1-2-9cf83",
    storageBucket: "pico-iot-v1-2-9cf83.appspot.com",
    messagingSenderId: "638387216051",
    appId: "1:638387216051:web:721a2747d1bd6fed829ac6",
    measurementId: "G-P10ENCQYRB"
};

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// **FIX:** Wrap all DOM interaction code in a DOMContentLoaded event listener.
// This ensures the script doesn't run until the entire HTML page is loaded.
document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Element References ---
    const loginFormEl = document.getElementById('login');
    const signupFormEl = document.getElementById('signup');
    const showSignupBtn = document.getElementById('show-signup');
    const showLoginBtn = document.getElementById('show-login');
    const loginDiv = document.getElementById('login-form');
    const signupDiv = document.getElementById('signup-form');

    // --- Functions ---

    const handleSignup = (e) => {
        e.preventDefault();
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;

        createUserWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                console.log('User signed up successfully:', userCredential.user);
                window.location.href = 'dashboard.html'; 
            })
            .catch((error) => {
                console.error('Signup Error:', error);
                alert(`Error creating account: ${error.message}`);
            });
    };

    const handleLogin = (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        signInWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                console.log('User logged in successfully:', userCredential.user);
                window.location.href = 'dashboard.html';
            })
            .catch((error) => {
                console.error('Login Error:', error);
                alert(`Error logging in: ${error.message}`);
            });
    };

    // --- Event Listeners ---
    if (signupFormEl && loginFormEl) {
        signupFormEl.addEventListener('submit', handleSignup);
        loginFormEl.addEventListener('submit', handleLogin);

        showSignupBtn.addEventListener('click', () => {
            loginDiv.style.display = 'none';
            signupDiv.style.display = 'block';
        });

        showLoginBtn.addEventListener('click', () => {
            signupDiv.style.display = 'none';
            loginDiv.style.display = 'block';
        });
    }
});

// --- Auth State Observer ---
// This part can stay outside because it doesn't interact with the DOM immediately.
// It just listens for auth changes.
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log('User is already logged in. Redirecting...');
        if (!window.location.pathname.includes('dashboard.html')) {
            window.location.href = 'dashboard.html';
        }
    }
});

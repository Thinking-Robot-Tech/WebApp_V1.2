// --- Firebase SDK Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Element References ---
    const loginFormEl = document.getElementById('login');
    const signupFormEl = document.getElementById('signup');
    const showSignupBtn = document.getElementById('show-signup');
    const showLoginBtn = document.getElementById('show-login');
    const loginDiv = document.getElementById('login-form');
    const signupDiv = document.getElementById('signup-form');

    // --- Functions ---

    const toggleButtonLoading = (form, isLoading) => {
        const button = form.querySelector('.auth-button');
        const buttonText = button.querySelector('.button-text');
        const spinner = button.querySelector('.spinner');
        if (isLoading) {
            button.disabled = true;
            buttonText.style.display = 'none';
            spinner.style.display = 'block';
        } else {
            button.disabled = false;
            buttonText.style.display = 'block';
            spinner.style.display = 'none';
        }
    };

    /**
     * Handles user signup. Creates an auth user and a corresponding
     * document in the 'users' collection in Firestore.
     * @param {Event} e The form submission event.
     */
    const handleSignup = (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value.trim();
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;

        if (!name) {
            alert('Please enter your name.');
            return;
        }
        
        toggleButtonLoading(signupFormEl, true);

        createUserWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                const user = userCredential.user;
                console.log('User signed up successfully:', user.uid);
                const userDocRef = doc(db, "users", user.uid);

                // **FIX**: Use a .then() chain to ensure setDoc completes before redirect.
                return setDoc(userDocRef, {
                    name: name,
                    email: user.email,
                    rooms: ["Living Room", "Bedroom", "Kitchen"],
                    createdAt: serverTimestamp()
                });
            })
            .then(() => {
                console.log('User document created in Firestore. Redirecting...');
                window.location.href = 'dashboard.html';
            })
            .catch((error) => {
                console.error('Signup Error:', error);
                alert(`Error creating account: ${error.message}`);
                toggleButtonLoading(signupFormEl, false);
            });
    };

    const handleLogin = (e) => {
        e.preventDefault();
        toggleButtonLoading(loginFormEl, true);
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        signInWithEmailAndPassword(auth, email, password)
            .then(() => {
                console.log('User logged in successfully');
                window.location.href = 'dashboard.html';
            })
            .catch((error) => {
                console.error('Login Error:', error);
                alert(`Error logging in: ${error.message}`);
                toggleButtonLoading(loginFormEl, false);
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

// The onAuthStateChanged listener has been removed from this file to prevent premature redirection.

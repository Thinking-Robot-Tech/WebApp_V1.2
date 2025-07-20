// --- Firebase SDK Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    setPersistence,
    browserLocalPersistence,
    onAuthStateChanged
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

// --- DOM Element References ---
const loadingOverlay = document.getElementById('loading-overlay');
const authWrapper = document.getElementById('auth-wrapper');
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
            const userDocRef = doc(db, "users", user.uid);

            const initialMemberId = 'member_' + Date.now();
            return setDoc(userDocRef, {
                email: user.email,
                createdAt: serverTimestamp(),
                profile: {
                    name: name,
                    photoURL: null
                },
                familyMembers: [
                    { id: initialMemberId, name: name, avatar: 'default_icon' }
                ],
                settings: {
                    theme: 'dark',
                    activeMemberId: initialMemberId
                },
                rooms: ["Living Room", "Bedroom", "Kitchen"]
            });
        })
        .then(() => {
            window.location.href = 'dashboard.html';
        })
        .catch((error) => {
            console.error('Signup Error:', error);
            alert(`Error creating account: ${error.message}`);
            toggleButtonLoading(signupFormEl, false);
        });
};

const handleLogin = async (e) => {
    e.preventDefault();
    toggleButtonLoading(loginFormEl, true);
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const rememberMe = document.getElementById('remember-me').checked;

    try {
        if (rememberMe) {
            await setPersistence(auth, browserLocalPersistence);
        }
        
        await signInWithEmailAndPassword(auth, email, password);
        window.location.href = 'dashboard.html';
    } catch (error) {
        console.error('Login Error:', error.code, error.message);
        
        if (error.code === 'auth/user-not-found') {
            alert('No account found with this email. Please sign up.');
            document.getElementById('signup-email').value = email;
            loginDiv.style.display = 'none';
            signupDiv.style.display = 'block';
        } else {
            alert(`Error logging in: ${error.message}`);
        }
        toggleButtonLoading(loginFormEl, false);
    }
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

// MODIFIED: This observer now handles the initial loading state
onAuthStateChanged(auth, (user) => {
    if (user) {
        // If a user session exists, redirect immediately.
        // The loading overlay will be visible until the dashboard page loads.
        const currentPage = window.location.pathname;
        if (!currentPage.includes('dashboard.html') && !currentPage.includes('profile.html') && !currentPage.includes('form.html')) {
            window.location.href = 'dashboard.html';
        }
    } else {
        // If no user is found, hide the loader and show the login form.
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        if (authWrapper) authWrapper.style.display = 'flex';
    }
});

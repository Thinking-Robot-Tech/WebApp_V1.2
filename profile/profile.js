// --- Firebase SDK Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

// --- Global State ---
let currentUserId = null;
let unsubscribeFromUser = null;

// --- DOM Element References ---
const userNameDisplay = document.getElementById('user-name-display');
const userEmailDisplay = document.getElementById('user-email-display');
const logoutBtn = document.getElementById('logout-btn');
const editNameModal = document.getElementById('edit-name-modal');
const editNameForm = document.getElementById('edit-name-form');
const newNameInput = document.getElementById('new-name-input');
const editNameBtn = document.getElementById('edit-name-btn');
const closeModalBtn = editNameModal.querySelector('.close-modal-btn');
const themeSelector = document.getElementById('theme-selector');

// --- Helper Functions ---
const toggleModal = (modalElement, show) => {
    if (modalElement) {
        modalElement.classList.toggle('visible', show);
    }
};

const applyTheme = (theme) => {
    const currentTheme = theme || 'dark';
    document.documentElement.dataset.theme = currentTheme;
    // THIS IS THE FIX: Cache the theme in localStorage for instant loading on the next page.
    try {
        localStorage.setItem('pico-theme', currentTheme);
    } catch (e) {
        console.error('Failed to save theme to localStorage:', e);
    }
    
    if (themeSelector) {
        themeSelector.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === currentTheme);
        });
    }
};

// --- Event Handlers ---
const handleLogout = () => {
    signOut(auth).catch((error) => console.error('Logout Error:', error));
};

const handleUpdateName = async (e) => {
    e.preventDefault();
    const newName = newNameInput.value.trim();
    if (newName && currentUserId) {
        const userDocRef = doc(db, 'users', currentUserId);
        try {
            await updateDoc(userDocRef, { 'profile.name': newName });
            toggleModal(editNameModal, false);
        } catch (error) {
            console.error("Error updating name: ", error);
            alert("Failed to update name.");
        }
    }
};

const handleThemeChange = async (e) => {
    const selectedTheme = e.target.closest('.theme-btn')?.dataset.theme;
    if (selectedTheme && currentUserId) {
        applyTheme(selectedTheme); // This now also saves to localStorage
        const userDocRef = doc(db, 'users', currentUserId);
        try {
            // Save to Firestore for persistence across devices/sessions
            await updateDoc(userDocRef, { 'settings.theme': selectedTheme });
        } catch (error) {
            console.error("Error updating theme in Firestore: ", error);
        }
    }
};

const setupUserListener = (userId) => {
    if (unsubscribeFromUser) unsubscribeFromUser();

    const userDocRef = doc(db, "users", userId);
    unsubscribeFromUser = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
            const userData = doc.data();
            const profileName = userData.profile?.name || userData.name || 'User';
            if (userNameDisplay) userNameDisplay.textContent = profileName;
            if (userEmailDisplay) userEmailDisplay.textContent = userData.email || 'No email';
            if (newNameInput) newNameInput.value = profileName;

            // The theme is already pre-applied by theme-loader.js.
            // This listener just ensures the active button and localStorage are in sync.
            const savedTheme = userData.settings?.theme || 'dark';
            applyTheme(savedTheme);
        } else {
            console.log("No such user document!");
            if (userNameDisplay) userNameDisplay.textContent = 'User Not Found';
        }
    }, (error) => {
        console.error("Error fetching user data:", error);
    });
};

const cleanupListeners = () => {
    if (unsubscribeFromUser) unsubscribeFromUser();
};

// --- Main Logic ---
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUserId = user.uid;
            setupUserListener(user.uid);
        } else {
            cleanupListeners();
            window.location.href = '../index.html';
        }
    });

    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (editNameBtn) editNameBtn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleModal(editNameModal, true);
    });
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => toggleModal(editNameModal, false));
    if (editNameForm) editNameForm.addEventListener('submit', handleUpdateName);
    if (themeSelector) themeSelector.addEventListener('click', handleThemeChange);
});

window.addEventListener('beforeunload', cleanupListeners);
    
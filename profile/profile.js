// --- Firebase SDK Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, onSnapshot, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
let currentUserData = null; // Cache user data

// --- DOM Element References ---
const userNameDisplay = document.getElementById('user-name-display');
const userEmailDisplay = document.getElementById('user-email-display');
const logoutBtn = document.getElementById('logout-btn');
const themeSelector = document.getElementById('theme-selector');
// Edit Name Modal
const editNameModal = document.getElementById('edit-name-modal');
const editNameForm = document.getElementById('edit-name-form');
const newNameInput = document.getElementById('new-name-input');
const editNameBtn = document.getElementById('edit-name-btn');
const closeEditNameModalBtn = editNameModal.querySelector('.close-modal-btn');
// Family Modal
const familyModal = document.getElementById('family-modal');
const familyMembersBtn = document.getElementById('family-members-btn');
const closeFamilyModalBtn = familyModal.querySelector('.close-modal-btn');
const familyListDiv = document.getElementById('family-list');
const addMemberForm = document.getElementById('add-member-form');
const newMemberNameInput = document.getElementById('new-member-name');

// --- Helper Functions ---
const toggleModal = (modalElement, show) => {
    if (modalElement) modalElement.classList.toggle('visible', show);
};

const applyTheme = (theme) => {
    const currentTheme = theme || 'dark';
    document.documentElement.dataset.theme = currentTheme;
    try { localStorage.setItem('pico-theme', currentTheme); } catch (e) { console.error('Failed to save theme:', e); }
    if (themeSelector) {
        themeSelector.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === currentTheme);
        });
    }
};

// --- Family Members Functions ---
const renderFamilyMembers = () => {
    if (!currentUserData || !familyListDiv) return;
    const { familyMembers = [], settings = {} } = currentUserData;
    const activeMemberId = settings.activeMemberId;

    familyListDiv.innerHTML = '';
    familyMembers.forEach(member => {
        const item = document.createElement('div');
        item.className = 'family-member-item';
        item.dataset.memberId = member.id;
        if (member.id === activeMemberId) {
            item.classList.add('active');
        }

        const avatar = document.createElement('div');
        avatar.className = 'member-avatar';
        avatar.textContent = member.name.charAt(0).toUpperCase();

        const name = document.createElement('span');
        name.className = 'member-name';
        name.textContent = member.name;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-member-btn';
        deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
        deleteBtn.dataset.memberId = member.id;

        item.appendChild(avatar);
        item.appendChild(name);
        item.appendChild(deleteBtn);
        familyListDiv.appendChild(item);
    });
};

const handleAddMember = async (e) => {
    e.preventDefault();
    const newName = newMemberNameInput.value.trim();
    if (!newName || !currentUserId) return;

    const newMember = {
        id: `member_${Date.now()}`,
        name: newName,
        avatar: 'default_icon'
    };

    const userDocRef = doc(db, 'users', currentUserId);
    try {
        await updateDoc(userDocRef, { familyMembers: arrayUnion(newMember) });
        newMemberNameInput.value = '';
    } catch (error) {
        console.error("Error adding family member:", error);
    }
};

const handleFamilyListClick = async (e) => {
    const target = e.target;
    const memberItem = target.closest('.family-member-item');
    const deleteButton = target.closest('.delete-member-btn');
    const userDocRef = doc(db, 'users', currentUserId);

    if (deleteButton) {
        const memberIdToDelete = deleteButton.dataset.memberId;
        const memberToDelete = currentUserData.familyMembers.find(m => m.id === memberIdToDelete);
        if (memberToDelete && currentUserData.familyMembers.length > 1) {
            try {
                await updateDoc(userDocRef, { familyMembers: arrayRemove(memberToDelete) });
                // If the deleted member was the active one, set the first member as active
                if (currentUserData.settings.activeMemberId === memberIdToDelete) {
                    await updateDoc(userDocRef, { 'settings.activeMemberId': currentUserData.familyMembers[0].id });
                }
            } catch (error) { console.error("Error deleting member:", error); }
        } else {
            alert("You cannot delete the last family member.");
        }
    } else if (memberItem) {
        const memberIdToActivate = memberItem.dataset.memberId;
        try {
            await updateDoc(userDocRef, { 'settings.activeMemberId': memberIdToActivate });
        } catch (error) { console.error("Error setting active member:", error); }
    }
};

// --- General Event Handlers ---
const handleLogout = () => { signOut(auth).catch((error) => console.error('Logout Error:', error)); };

const handleUpdateName = async (e) => {
    e.preventDefault();
    const newName = newNameInput.value.trim();
    if (newName && currentUserId) {
        const userDocRef = doc(db, 'users', currentUserId);
        try {
            await updateDoc(userDocRef, { 'profile.name': newName });
            toggleModal(editNameModal, false);
        } catch (error) { console.error("Error updating name: ", error); alert("Failed to update name."); }
    }
};

const handleThemeChange = async (e) => {
    const selectedTheme = e.target.closest('.theme-btn')?.dataset.theme;
    if (selectedTheme && currentUserId) {
        applyTheme(selectedTheme);
        const userDocRef = doc(db, 'users', currentUserId);
        try { await updateDoc(userDocRef, { 'settings.theme': selectedTheme }); } 
        catch (error) { console.error("Error updating theme in Firestore: ", error); }
    }
};

const setupUserListener = (userId) => {
    if (unsubscribeFromUser) unsubscribeFromUser();
    const userDocRef = doc(db, "users", userId);
    unsubscribeFromUser = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
            currentUserData = doc.data(); // Cache the latest user data
            const { profile, email, settings } = currentUserData;
            const profileName = profile?.name || 'User';
            
            if (userNameDisplay) userNameDisplay.textContent = profileName;
            if (userEmailDisplay) userEmailDisplay.textContent = email || 'No email';
            if (newNameInput) newNameInput.value = profileName;

            applyTheme(settings?.theme);
            renderFamilyMembers();
        } else {
            console.log("No such user document!");
            if (userNameDisplay) userNameDisplay.textContent = 'User Not Found';
        }
    }, (error) => console.error("Error fetching user data:", error));
};

const cleanupListeners = () => { if (unsubscribeFromUser) unsubscribeFromUser(); };

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
    if (editNameBtn) editNameBtn.addEventListener('click', (e) => { e.preventDefault(); toggleModal(editNameModal, true); });
    if (closeEditNameModalBtn) closeEditNameModalBtn.addEventListener('click', () => toggleModal(editNameModal, false));
    if (editNameForm) editNameForm.addEventListener('submit', handleUpdateName);
    if (themeSelector) themeSelector.addEventListener('click', handleThemeChange);
    if (familyMembersBtn) familyMembersBtn.addEventListener('click', (e) => { e.preventDefault(); toggleModal(familyModal, true); });
    if (closeFamilyModalBtn) closeFamilyModalBtn.addEventListener('click', () => toggleModal(familyModal, false));
    if (addMemberForm) addMemberForm.addEventListener('submit', handleAddMember);
    if (familyListDiv) familyListDiv.addEventListener('click', handleFamilyListClick);
});

window.addEventListener('beforeunload', cleanupListeners);

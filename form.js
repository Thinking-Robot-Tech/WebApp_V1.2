// --- Firebase SDK Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
const db = getFirestore(app);

// --- DOM Element References ---
const configForm = document.getElementById('device-config-form');
const claimCodeInput = document.getElementById('claim-code');
const submitBtn = document.getElementById('submit-btn');

const configView = document.getElementById('config-form-view');
const statusView = document.getElementById('status-view');
const statusText = document.getElementById('status-text');
const successView = document.getElementById('success-view');

/**
 * This function simulates the entire process that the physical PICO device firmware would perform.
 * It reads the deviceName and room from the claim document in Firestore.
 * @param {Event} e The form submission event.
 */
const handleVirtualDeviceClaim = async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    
    const urlParams = new URLSearchParams(window.location.search);
    const macAddress = urlParams.get('mac');
    const userClaimCode = claimCodeInput.value.trim();

    if (!macAddress || !userClaimCode) {
        alert("Error: Missing MAC Address from URL or Claim Code is empty.");
        submitBtn.disabled = false;
        return;
    }

    configView.style.display = 'none';
    statusView.style.display = 'block';
    statusText.textContent = 'Verifying claim code...';

    try {
        const claimRef = doc(db, 'deviceClaims', macAddress);
        const claimSnap = await getDoc(claimRef);

        if (!claimSnap.exists() || claimSnap.data().claimCode !== userClaimCode) {
            statusText.textContent = 'Error: Invalid claim code or the request has expired.';
            return;
        }

        statusText.textContent = 'Claim code verified. Creating device...';
        
        const claimData = claimSnap.data();
        const deviceRef = doc(db, 'devices', macAddress);

        await setDoc(deviceRef, {
            ownerId: claimData.ownerId,
            name: claimData.deviceName, // Use name from claim document
            type: claimData.isVirtual ? 'PICO-VRT1' : 'PICO-DEV1', // Use type from claim
            room: claimData.room, // Use room from claim document
            state: {
                isOn: false,
                isOnline: true 
            },
            lastSeen: serverTimestamp(),
            createdAt: serverTimestamp()
        });

        await deleteDoc(claimRef);
        
        statusView.style.display = 'none';
        successView.style.display = 'block';

    } catch (error) {
        console.error("Error during device claim process:", error);
        statusText.textContent = `An unexpected error occurred: ${error.message}`;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get('code');
    if (codeFromUrl) {
        claimCodeInput.value = codeFromUrl;
    }

    // The logic to hide the device name input is no longer needed as it's removed from the HTML.
    configForm.addEventListener('submit', handleVirtualDeviceClaim);
});

/* global __initial_auth_token */ // __initial_auth_token is still a Canvas global for specific auth scenarios
import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom'; // Import ReactDOM for portals
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
// eslint-disable-next-line no-unused-vars
import { getFirestore, collection, query, onSnapshot, doc, setDoc, addDoc, deleteDoc, getDocs } from 'firebase/firestore';
// Removed XCircle, Search, Settings, Filter as they were unused based on ESLint report
import { CheckCircle, Sparkles, PlusCircle, Edit, Trash2, Save, X, Link, Brain, Download, Lightbulb } from 'lucide-react'; // Added Download and Lightbulb icon
import { getFunctions, httpsCallable } from 'firebase/functions'; // Import getFunctions and httpsCallable

// IMPORTANT: For Netlify deployment, environment variables are accessed via process.env
// and need to be prefixed with REACT_APP_ (e.g., REACT_APP_APP_ID, REACT_APP_FIREBASE_CONFIG).
// For local development or Canvas preview, you might use a .env file or specific globals.
// This code is designed for Netlify deployment.
const appId = typeof process.env.REACT_APP_APP_ID !== 'undefined' ? process.env.REACT_APP_APP_ID : 'default-app-id';
let firebaseConfig = {};
try {
    // --- ADDED FOR DEBUGGING NETLIFY ENV VAR ISSUE ---
    const rawFirebaseConfig = process.env.REACT_APP_FIREBASE_CONFIG;
    console.log("Raw REACT_APP_FIREBASE_CONFIG from process.env:");
    console.log("  Type:", typeof rawFirebaseConfig);
    console.log("  Length:", rawFirebaseConfig ? rawFirebaseConfig.length : 'N/A');
    console.log("  First 20 chars:", rawFirebaseConfig ? rawFirebaseConfig.substring(0, 20) : 'N/A');
    console.log("  Last 20 chars:", rawFirebaseConfig ? rawFirebaseConfig.substring(rawFirebaseConfig.length - 20) : 'N/A');
    // --- END DEBUGGING ADDITION ---

    firebaseConfig = typeof rawFirebaseConfig !== 'undefined' ? JSON.parse(rawFirebaseConfig) : {};
    console.log("Parsed firebaseConfig:", firebaseConfig); // Re-added this log
} catch (e) {
    console.error("Error parsing REACT_APP_FIREBASE_CONFIG:", e);
    // Fallback or error handling if JSON parsing fails
}


// Initialize Firebase outside the component to prevent re-initialization
let app, db, auth, functions; // Declare functions here
// Added a check to ensure firebaseConfig is a non-empty object with projectId before initializing
if (Object.keys(firebaseConfig).length > 0 && firebaseConfig.projectId) {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        functions = getFunctions(app); // Initialize functions
    } catch (error) {
        console.error("Firebase initialization error:", error);
        // Handle error, e.g., display a message to the user
    }
} else {
    console.error("Firebase configuration is missing or incomplete. Cannot initialize Firebase.");
    // Optionally set a state or show a message indicating Firebase is not initialized
}

// Custom Confirmation Modal Component
const ConfirmationModal = ({ message, onConfirm, onCancel, showCancel = true }) => {
    // Revert aggressive styling, keep high z-index and standard modal look
    console.log("ConfirmationModal is rendering!");
    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-[9999]">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center border border-gray-200">
                <p className="text-lg font-semibold mb-6 text-gray-800">{message}</p>
                <div className="flex justify-center gap-4">
                    <button
                        onClick={onConfirm}
                        className="px-5 py-2 bg-purple-600 text-white font-semibold rounded-md shadow-md hover:bg-purple-700 transition-colors"
                    >
                        Confirm
                    </button>
                    {showCancel && (
                        <button
                            onClick={onCancel}
                            className="px-5 py-2 bg-gray-300 text-gray-800 font-semibold rounded-md shadow-md hover:bg-gray-400 transition-colors"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};


const App = () => {
    const [concerns, setConcerns] = useState([]);
    const [ingredients, setIngredients] = useState([]);
    const [products, setProducts] = useState([]);
    const [concernIngredientMappings, setConcernIngredientMappings] = useState([]);
    const [selectedConcerns, setSelectedConcerns] = useState([]);
    const [recommendedIngredients, setRecommendedIngredients] = useState([]);
    const [recommendedProducts, setRecommendedProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [activeTab, setActiveTab] = useState('customer');
    const [adminSubTab, setAdminSubTab] = useState('concerns');

    // State for admin forms
    const [newConcernName, setNewConcernName] = useState('');
    const [newIngredientName, setNewIngredientName] = useState('');
    const [newIngredientDescription, setNewIngredientDescription] = useState('');
    const [newProductName, setNewProductName] = useState('');
    const [newProductDescription, setNewProductDescription] = useState('');
    const [newProductImageUrl, setNewProductImageUrl] = useState('');
    const [newProductShopifyUrl, setNewProductShopifyUrl] = useState('');
    const [newProductTargetIngredients, setNewProductTargetIngredients] = useState([]);

    // State for mapping form
    const [selectedConcernForMapping, setSelectedConcernForMapping] = useState('');
    const [selectedIngredientsForMapping, setSelectedIngredientsForMapping] = useState([]);
    const [editingMapping, setEditingMapping] = useState(null);

    const [editingConcern, setEditingConcern] = useState(null);
    const [editingIngredient, setEditingIngredient] = useState(null);
    const [editingProduct, setEditingProduct] = useState(null);

    // State for confirmation modal
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmAction, setConfirmAction] = useState(null);
    const [confirmMessage, setConfirmMessage] = useState('');
    const [confirmShowCancel, setConfirmShowCancel] = useState(true);

    // States for search filters
    const [concernFilter, setConcernFilter] = useState('');
    const [ingredientFilter, setIngredientFilter] = useState('');
    const [productFilter, setProductFilter] = useState('');
    const [mappingFilter, setMappingFilter] = useState('');

    // State for highlighting newly added AI ingredients
    const [newlyAddedAIIngredientIds, setNewlyAddedAIIngredientIds] = useState([]);

    // States for bulk selection
    const [selectedConcernIds, setSelectedConcernIds] = useState([]);
    const [selectedIngredientIds, setSelectedIngredientIds] = useState([]);
    const [selectedProductIds, setSelectedProductIds] = useState([]);
    const [selectedMappingIds, setSelectedMappingIds] = useState([]);

    // New state for simulated user role
    const [userRole, setUserRole] = useState('customer'); // 'customer' or 'admin'

    // New state for custom concern input and current recommendations source
    const [customConcernInput, setCustomConcernInput] = useState('');
    const [currentCustomerConcern, setCurrentCustomerConcern] = useState(''); // Stores the concern that recommendations are based on

    // NEW STATES for Shopify Integration
    const [shopifyStoreDomain, setShopifyStoreDomain] = useState('');
    const [shopifyApiKey, setShopifyApiKey] = useState('');
    const [fetchingShopifyProducts, setFetchingShopifyProducts] = useState(false);

    // NEW STATE for AI suggested concerns in Admin view
    const [aiSuggestedConcernNames, setAiSuggestedConcernNames] = useState([]);
    const [generatingConcernSuggestions, setGeneratingConcernSuggestions] = useState(false);

    // NEW STATE for AI suggested ingredients in Admin Mapping tab
    const [aiSuggestedIngredientsForMappingTab, setAiSuggestedIngredientsForMappingTab] = useState([]);
    const [generatingAIIngredientsForMappingTab, setGeneratingAIIngredientsForMappingTab] = useState(false);


    const publicDataPath = `artifacts/${appId}/public/data`;

    // Function to add sample data (for demonstration purposes)
    // Wrapped in useCallback to ensure it's stable and doesn't cause unnecessary re-renders
    const addSampleData = useCallback(async () => {
        if (!db) {
            console.error("Firestore not initialized. Cannot add sample data.");
            return;
        }
        console.log("Attempting to add sample data to path:", publicDataPath); // Log the path

        // Sample Concerns
        const sampleConcerns = [
            { id: 'concern_acne', name: 'Acne' },
            { id: 'concern_dryness', name: 'Dryness' },
            { id: 'concern_finelines', name: 'Fine Lines & Wrinkles' },
            { id: 'concern_redness', name: 'Redness' },
            { id: 'concern_hyperpigmentation', name: 'Hyperpigmentation' },
            { id: 'concern_dullness', name: 'Dullness' },
        ];

        // Sample Ingredients
        const sampleIngredients = [
            { id: 'ing_salicylic', name: 'Salicylic Acid', description: 'Exfoliates inside pores, good for acne.' },
            { id: 'ing_hyaluronic', name: 'Hyaluronic Acid', description: 'Attracts and holds moisture, great for dryness.' },
            { id: 'ing_retinol', name: 'Retinol', description: 'Boosts cell turnover, reduces fine lines.' },
            { id: 'ing_niacinamide', name: 'Niacinamide', description: 'Reduces redness and improves skin barrier.' },
            { id: 'ing_vitaminc', name: 'Vitamin C', description: 'Brightens skin and reduces hyperpigmentation.' },
            { id: 'ing_aha', name: 'Alpha Hydroxy Acids (AHAs)', description: 'Exfoliates dead skin cells, improves texture.' },
        ];

        // Sample Products
        const sampleProducts = [
            {
                id: 'prod_acne_cleanser',
                name: 'Acne Clearing Cleanser',
                description: 'A gentle cleanser with salicylic acid to combat breakouts.',
                imageUrl: 'https://placehold.co/100x100/ADD8E6/000000?text=Acne+Cleanser',
                targetIngredients: ['Salicylic Acid'],
                shopifyUrl: 'https://example.com/shopify/acne-cleanser'
            },
            {
                id: 'prod_hydrating_serum',
                name: 'Deep Hydration Serum',
                description: 'Infused with hyaluronic acid for intense moisture.',
                imageUrl: 'https://placehold.co/100x100/B0E0E6/000000?text=Hydrating+Serum',
                targetIngredients: ['Hyaluronic Acid', 'Niacinamide'],
                shopifyUrl: 'https://example.com/shopify/hydrating-serum'
            },
            {
                id: 'prod_antiaging_cream',
                name: 'Youthful Glow Cream',
                description: 'Retinol-powered cream to smooth fine lines and wrinkles.',
                imageUrl: 'https://placehold.co/100x100/87CEEB/000000?text=Anti-Aging+Cream',
                targetIngredients: ['Retinol', 'Hyaluronic Acid'],
                shopifyUrl: 'https://example.com/shopify/anti-aging-cream'
            },
            {
                id: 'prod_brightening_mask',
                name: 'Radiance Boosting Mask',
                description: 'Vitamin C mask for a brighter, more even complexion.',
                imageUrl: 'https://placehold.co/100x100/6495ED/000000?text=Brightening+Mask',
                targetIngredients: ['Vitamin C', 'Alpha Hydroxy Acids (AHAs)'],
                shopifyUrl: 'https://example.com/shopify/brightening-mask'
            },
            {
                id: 'prod_calming_lotion',
                name: 'Redness Relief Lotion',
                description: 'Soothes irritated skin with niacinamide.',
                imageUrl: 'https://placehold.co/100x100/4682B4/000000?text=Calming+Lotion',
                targetIngredients: ['Niacinamide'],
                shopifyUrl: 'https://example.com/shopify/calming-lotion'
            },
        ];

        // Sample Mappings (matching the hardcoded ones for initial consistency)
        const sampleMappings = [
            { id: 'map_acne', concernName: 'Acne', ingredientNames: ['Salicylic Acid', 'Niacinamide'] },
            { id: 'map_dryness', concernName: 'Dryness', ingredientNames: ['Hyaluronic Acid', 'Niacinamide'] },
            { id: 'map_finelines', concernName: 'Fine Lines & Wrinkles', ingredientNames: ['Retinol', 'Hyaluronic Acid'] },
            { id: 'map_redness', concernName: 'Redness', ingredientNames: ['Niacinamide'] },
            { id: 'map_hyperpigmentation', concernName: 'Hyperpigmentation', ingredientNames: ['Vitamin C', 'Alpha Hydroxy Acids (AHAs)'] },
            { id: 'map_dullness', concernName: 'Dullness', ingredientNames: ['Vitamin C', 'Alpha Hydroxy Acids (AHAs)', 'Niacinamide'] },
        ];


        // Check if data already exists before adding
        const concernsColRef = collection(db, `${publicDataPath}/concerns`);
        const concernsSnapshot = await getDocs(concernsColRef);
        if (concernsSnapshot.empty) {
            console.log("Adding sample concerns...");
            for (const concern of sampleConcerns) {
                await setDoc(doc(concernsColRef, concern.id), concern);
            }
        } else {
            console.log("Concerns collection is not empty. Skipping sample data addition for concerns.");
        }

        const ingredientsColRef = collection(db, `${publicDataPath}/ingredients`);
        const ingredientsSnapshot = await getDocs(ingredientsColRef);
        if (ingredientsSnapshot.empty) {
            console.log("Adding sample ingredients...");
            for (const ingredient of sampleIngredients) {
                await setDoc(doc(ingredientsColRef, ingredient.id), ingredient);
            }
        } else {
            console.log("Ingredients collection is not empty. Skipping sample data addition for ingredients.");
        }

        const productsColRef = collection(db, `${publicDataPath}/products`);
        const productsSnapshot = await getDocs(productsColRef);
        if (productsSnapshot.empty) {
            console.log("Adding sample products...");
            for (const product of sampleProducts) {
                await setDoc(doc(productsColRef, product.id), product);
            }
        } else {
            console.log("Products collection is not empty. Skipping sample data addition for products.");
        }

        const mappingsColRef = collection(db, `${publicDataPath}/concernIngredientMappings`);
        const mappingsSnapshot = await getDocs(mappingsColRef);
        if (mappingsSnapshot.empty) {
            console.log("Adding sample mappings...");
            for (const mapping of sampleMappings) {
                await setDoc(doc(mappingsColRef, mapping.id), mapping);
            }
        } else {
            console.log("Mappings collection is not empty. Skipping sample data addition for mappings.");
        }
        console.log("Sample data check/addition complete.");
    }, [publicDataPath]);


    // Firebase Initialization and Authentication
    useEffect(() => {
        // Ensure Firebase app, db, and auth are initialized before proceeding
        // This check is crucial if the initial Firebase setup failed due to missing config
        if (!app || !db || !auth) {
            console.error("Firebase not fully initialized. Skipping auth and data fetch.");
            setLoading(false); // Stop loading if Firebase didn't initialize
            return;
        }

        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                console.log("Signed in with user ID:", user.uid);
            } else {
                try {
                    // Use __initial_auth_token if available, otherwise sign in anonymously
                    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                        await signInWithCustomToken(auth, __initial_auth_token);
                        console.log("Signed in with custom token.");
                    } else {
                        await signInAnonymously(auth);
                        console.log("Signed in anonymously.");
                    }
                } catch (error) {
                    console.error("Firebase authentication error:", error);
                }
            }
            setIsAuthReady(true); // Mark auth as ready after initial check/sign-in
        });

        return () => unsubscribeAuth();
    }, []); // Run only once on component mount

    // Fetch data from Firestore once authenticated
    useEffect(() => {
        console.log("Data fetch useEffect triggered. isAuthReady:", isAuthReady, "db:", !!db);
        if (!isAuthReady || !db) { // Also check if db is initialized
            console.log("Data fetch skipped: Auth not ready or db not initialized.");
            return;
        }

        // addSampleData is now wrapped in useCallback, making it a stable dependency.
        addSampleData();

        // Listen for concerns
        const unsubscribeConcerns = onSnapshot(collection(db, `${publicDataPath}/concerns`), (snapshot) => {
            const fetchedConcerns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("Fetched concerns:", fetchedConcerns); // Log fetched concerns
            setConcerns(fetchedConcerns);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching concerns:", error);
            setLoading(false);
        });

        // Listen for ingredients
        const unsubscribeIngredients = onSnapshot(collection(db, `${publicDataPath}/ingredients`), (snapshot) => {
            const fetchedIngredients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("Fetched ingredients:", fetchedIngredients); // Log fetched ingredients
            setIngredients(fetchedIngredients);
        }, (error) => {
            console.error("Error fetching ingredients:", error);
        });

        // Listen for products
        const unsubscribeProducts = onSnapshot(collection(db, `${publicDataPath}/products`), (snapshot) => {
            const fetchedProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("Fetched products:", fetchedProducts); // Log fetched products
            setProducts(fetchedProducts);
        }, (error) => {
            console.error("Error fetching products:", error);
        });

        // Listen for concern-ingredient mappings
        const unsubscribeMappings = onSnapshot(collection(db, `${publicDataPath}/concernIngredientMappings`), (snapshot) => {
            const fetchedMappings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("Fetched mappings:", fetchedMappings); // Log fetched mappings
            setConcernIngredientMappings(fetchedMappings);
        }, (error) => {
            console.error("Error fetching concern ingredient mappings:", error);
        });


        return () => {
            unsubscribeConcerns();
            unsubscribeIngredients();
            unsubscribeProducts();
            unsubscribeMappings();
        };
    }, [isAuthReady, addSampleData, publicDataPath]); // 'db' is removed as it's a static object from outside the component

    // Logic to update recommendations based on selected concerns and dynamic mappings
    useEffect(() => {
        // If a custom concern is active, recommendations are handled by handleGenerateRecommendationsForCustomer.
        // This useEffect should only calculate for pre-defined concerns.
        if (currentCustomerConcern) {
            // If custom concern is active, the recommendations are already set by handleGenerateRecommendationsForCustomer.
            // This useEffect should not recalculate or cause further updates based on these.
            return;
        }

        // If no pre-defined concerns are selected, clear recommendations.
        if (selectedConcerns.length === 0) {
            setRecommendedIngredients([]);
            setRecommendedProducts([]);
            return;
        }

        const uniqueRecommendedIngredients = new Set();
        selectedConcerns.forEach(concernName => {
            const mapping = concernIngredientMappings.find(m => m.concernName === concernName);
            if (mapping && mapping.ingredientNames) {
                mapping.ingredientNames.forEach(ing => uniqueRecommendedIngredients.add(ing));
            }
        });

        const filteredIngredients = ingredients.filter(ing => uniqueRecommendedIngredients.has(ing.name));
        setRecommendedIngredients(filteredIngredients);

        const filteredProducts = products.filter(product =>
            product.targetIngredients && product.targetIngredients.some(prodIng =>
                Array.from(uniqueRecommendedIngredients).includes(prodIng)
            )
        );
        setRecommendedProducts(filteredProducts);

    }, [selectedConcerns, ingredients, products, concernIngredientMappings, currentCustomerConcern]); // Removed recommendedIngredients from dependencies


    const handleConcernToggle = (concernName) => {
        setSelectedConcerns(prevSelected =>
            prevSelected.includes(concernName)
                ? prevSelected.filter(name => name !== concernName)
                : [...prevSelected, concernName]
        );
        setCustomConcernInput(''); // Clear custom input when pre-defined concerns are selected
        setCurrentCustomerConcern(''); // Clear custom concern source
    };

    // --- Confirmation Modal Handlers ---
    const showConfirmation = useCallback((message, action, showCancel = true) => {
        setConfirmMessage(message);
        setConfirmAction(() => action); // Use a function to set the action
        setConfirmShowCancel(showCancel);
        setShowConfirmModal(true);
        console.log("Confirmation modal triggered with message:", message); // NEW LOG
    }, [setConfirmMessage, setConfirmAction, setConfirmShowCancel, setShowConfirmModal]); // Added all setters to dependency array

    const handleConfirm = useCallback(() => {
        if (confirmAction) {
            confirmAction();
        }
        setShowConfirmModal(false);
        setConfirmAction(null);
        setConfirmMessage('');
        setConfirmShowCancel(true); // Added to dependency array
    }, [confirmAction, setShowConfirmModal, setConfirmAction, setConfirmMessage, setConfirmShowCancel]); // Added all setters to dependency array

    const handleCancelConfirm = useCallback(() => {
        setShowConfirmModal(false);
        setConfirmAction(null);
        setConfirmMessage('');
        setConfirmShowCancel(true); // Added to dependency array
    }, [setShowConfirmModal, setConfirmAction, setConfirmMessage, setConfirmShowCancel]); // Added all setters to dependency array

    // Handler for generating recommendations for customer view
    const handleGenerateRecommendationsForCustomer = async (concernText) => {
        if (!concernText.trim() && selectedConcerns.length === 0) {
            showConfirmation("Please select a concern or enter your own.", null, false);
            return;
        }

        setLoading(true);
        setNewlyAddedAIIngredientIds([]); // Clear previous highlights
        setRecommendedIngredients([]);
        setRecommendedProducts([]);

        let prompt = "";
        let currentSource = "";

        if (concernText.trim()) {
            prompt = `Given the beauty concern: "${concernText.trim()}", what are the top 3-5 key skincare ingredients that would effectively address this? Provide only the ingredient names, separated by commas. Also, briefly describe what each ingredient does in a sentence or two. For example: "Ingredient1: Description1, Ingredient2: Description2".`;
            currentSource = concernText.trim();
        } else if (selectedConcerns.length > 0) {
            prompt = `Given the beauty concerns: "${selectedConcerns.join(', ')}", what are the top 3-5 key skincare ingredients that would effectively address these? Provide only the ingredient names, separated by commas. Also, briefly describe what each ingredient does in a sentence or two. For example: "Ingredient1: Description1, Ingredient2: Description2".`;
            currentSource = selectedConcerns.join(', ');
        }

        setCurrentCustomerConcern(currentSource); // Set the concern that recommendations are based on

        try {
            const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
            if (!apiKey) {
                showConfirmation("Gemini API Key is not configured. Please contact support.", null, false);
                setLoading(false);
                return;
            }

            const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = { contents: chatHistory };
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const text = result.candidates[0].content.parts[0].text;
                console.log("Gemini Raw Response:", text); // Log raw Gemini response

                // Parse the response to extract ingredients and descriptions
                const parsedIngredients = text.split(', ').map(item => {
                    const [name, description] = item.split(':').map(s => s.trim());
                    return { name, description: description || '' };
                });

                // Identify and add new ingredients to Firestore
                const existingIngredientNames = new Set(ingredients.map(ing => ing.name.toLowerCase()));
                const newIngredientPromises = [];
                const newlyAddedIds = [];

                for (const aiIng of parsedIngredients) {
                    if (!existingIngredientNames.has(aiIng.name.toLowerCase())) {
                        newIngredientPromises.push(
                            handleAddIngredient(aiIng.name, aiIng.description)
                                .then(newDoc => {
                                    if (newDoc) {
                                        newlyAddedIds.push(newDoc.id);
                                    }
                                    return newDoc;
                                })
                        );
                    }
                }

                await Promise.all(newIngredientPromises);
                setNewlyAddedAIIngredientIds(newlyAddedIds); // Store IDs of newly added ingredients for highlighting

                // Filter products based on ALL recommended ingredients (both existing and newly added)
                const allRecommendedNames = new Set(ingredients.map(ing => ing.name)); // Start with existing
                parsedIngredients.forEach(aiIng => allRecommendedNames.add(aiIng.name)); // Add AI suggested

                const filteredProducts = products.filter(product =>
                    product.targetIngredients && product.targetIngredients.some(prodIng =>
                        allRecommendedNames.has(prodIng)
                    )
                );

                // Set recommended ingredients (from AI) and products
                setRecommendedIngredients(parsedIngredients.filter(ing => allRecommendedNames.has(ing.name)));
                setRecommendedProducts(filteredProducts);

            } else {
                showConfirmation("No recommendations found. Please try a different concern.", null, false);
            }
        } catch (error) {
            console.error("Error generating recommendations:", error);
            showConfirmation("Failed to get recommendations. Please try again.", null, false);
        } finally {
            setLoading(false);
        }
    };


    // --- Admin Functions ---

    // Concerns
    const handleAddConcern = async () => {
        if (newConcernName.trim() === '') {
            showConfirmation("Concern name cannot be empty.", null, false);
            return;
        }
        try {
            await addDoc(collection(db, `${publicDataPath}/concerns`), { name: newConcernName.trim() });
            setNewConcernName('');
        } catch (e) {
            console.error("Error adding concern: ", e);
            showConfirmation("Failed to add concern. Please try again.", null, false);
        }
    };

    const handleEditConcern = (concern) => {
        setEditingConcern(concern);
        setNewConcernName(concern.name);
    };

    const handleUpdateConcern = async () => {
        if (!editingConcern || newConcernName.trim() === '') {
            showConfirmation("Concern name cannot be empty.", null, false);
            return;
        }
        try {
            await setDoc(doc(db, `${publicDataPath}/concerns`, editingConcern.id), { name: newConcernName.trim() });
            setEditingConcern(null);
            setNewConcernName('');
        } catch (e) {
            console.error("Error updating concern: ", e);
            showConfirmation("Failed to update concern. Please try again.", null, false);
        }
    };

    const handleDeleteConcern = async (id) => {
        try {
            await deleteDoc(doc(db, `${publicDataPath}/concerns`, id));
        } catch (e) {
            console.error("Error deleting concern: ", e);
            showConfirmation("Failed to delete concern. Please try again.", null, false);
        }
    };

    const handleDeleteSelectedConcerns = () => {
        if (selectedConcernIds.length === 0) {
            showConfirmation("No concerns selected for deletion.", null, false);
            return;
        }
        showConfirmation(`Are you sure you want to delete ${selectedConcernIds.length} selected concerns?`, async () => {
            for (const id of selectedConcernIds) {
                await handleDeleteConcern(id); // Re-use individual delete logic
            }
            setSelectedConcernIds([]); // Clear selection after deletion
        });
    };

    const handleToggleSelectConcern = (id) => {
        setSelectedConcernIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    // NEW: Function to generate AI concern suggestions for Admin
    const handleGenerateConcernSuggestions = async () => {
        setGeneratingConcernSuggestions(true);
        setAiSuggestedConcernNames([]); // Clear previous suggestions
        const prompt = `Suggest 5-7 common and distinct beauty concerns related to skin, hair, or general well-being. Provide only the concern names, separated by commas. For example: "Acne, Dryness, Fine Lines, Redness".`;

        try {
            const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
            if (!apiKey) {
                showConfirmation("Gemini API Key is not configured. Please contact support.", null, false);
                setGeneratingConcernSuggestions(false);
                return;
            }

            const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = { contents: chatHistory };
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const text = result.candidates[0].content.parts[0].text;
                const suggestions = text.split(',').map(s => s.trim()).filter(s => s !== '');
                setAiSuggestedConcernNames(suggestions);
            } else {
                showConfirmation("No AI suggestions found. Please try again.", null, false);
            }
        } catch (error) {
            console.error("Error generating AI concern suggestions:", error);
            showConfirmation("Failed to get AI suggestions. Please try again.", null, false);
        } finally {
            setGeneratingConcernSuggestions(false);
        }
    };


    // Ingredients
    const handleAddIngredient = async (name, description = '') => {
        if (name.trim() === '') {
            showConfirmation("Ingredient name cannot be empty.", null, false);
            return null; // Indicate failure by returning null
        }
        try {
            const docRef = await addDoc(collection(db, `${publicDataPath}/ingredients`), {
                name: name.trim(),
                description: description.trim()
            });
            // Return the full ingredient object including its ID
            return { id: docRef.id, name: name.trim(), description: description.trim() };
        } catch (e) {
            console.error("Error adding ingredient: ", e);
            showConfirmation("Failed to add ingredient. Please try again.", null, false);
            return null;
        }
    };

    const handleEditIngredient = (ingredient) => {
        setEditingIngredient(ingredient);
        setNewIngredientName(ingredient.name);
        setNewIngredientDescription(ingredient.description);
    };

    const handleUpdateIngredient = async () => {
        if (!editingIngredient || newIngredientName.trim() === '') {
            showConfirmation("Ingredient name cannot be empty.", null, false);
            return;
        }
        try {
            await setDoc(doc(db, `${publicDataPath}/ingredients`, editingIngredient.id), {
                name: newIngredientName.trim(),
                description: newIngredientDescription.trim()
            });
            setEditingIngredient(null);
            setNewIngredientName('');
            setNewIngredientDescription('');
        } catch (e) {
            console.error("Error updating ingredient: ", e);
            showConfirmation("Failed to update ingredient. Please try again.", null, false);
        }
    };

    const handleDeleteIngredient = (id) => {
        showConfirmation("Are you sure you want to delete this ingredient?", async () => {
            try {
                await deleteDoc(doc(db, `${publicDataPath}/ingredients`, id));
            } catch (e) {
                console.error("Error deleting ingredient: ", e);
                showConfirmation("Failed to delete ingredient. Please try again.", null, false);
            }
        });
    };

    const handleDeleteSelectedIngredients = () => {
        if (selectedIngredientIds.length === 0) {
            showConfirmation("No ingredients selected for deletion.", null, false);
            return;
        }
        showConfirmation(`Are you sure you want to delete ${selectedIngredientIds.length} selected ingredients?`, async () => {
            for (const id of selectedIngredientIds) {
                await handleDeleteIngredient(id);
            }
            setSelectedIngredientIds([]);
        });
    };

    const handleToggleSelectIngredient = (id) => {
        setSelectedIngredientIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };


    // Products
    const handleAddProduct = async () => {
        if (newProductName.trim() === '') {
            showConfirmation("Product name cannot be empty.", null, false);
            return;
        }
        try {
            await addDoc(collection(db, `${publicDataPath}/products`), {
                name: newProductName.trim(),
                description: newProductDescription.trim(),
                imageUrl: newProductImageUrl.trim(),
                shopifyUrl: newProductShopifyUrl.trim(),
                targetIngredients: newProductTargetIngredients,
            });
            setNewProductName('');
            setNewProductDescription('');
            setNewProductImageUrl('');
            setNewProductShopifyUrl('');
            setNewProductTargetIngredients([]);
        } catch (e) {
            console.error("Error adding product: ", e);
            showConfirmation("Failed to add product. Please try again.", null, false);
        }
    };

    const handleEditProduct = (product) => {
        setEditingProduct(product);
        setNewProductName(product.name);
        setNewProductDescription(product.description);
        setNewProductImageUrl(product.imageUrl);
        setNewProductShopifyUrl(product.shopifyUrl);
        setNewProductTargetIngredients(product.targetIngredients || []);
    };

    const handleUpdateProduct = async () => {
        if (!editingProduct || newProductName.trim() === '') {
            showConfirmation("Product name cannot be empty.", null, false);
            return;
        }
        try {
            await setDoc(doc(db, `${publicDataPath}/products`, editingProduct.id), {
                name: newProductName.trim(),
                description: newProductDescription.trim(),
                imageUrl: newProductImageUrl.trim(),
                shopifyUrl: newProductShopifyUrl.trim(),
                targetIngredients: newProductTargetIngredients,
            });
            setEditingProduct(null);
            setNewProductName('');
            setNewProductDescription('');
            setNewProductImageUrl('');
            setNewProductShopifyUrl('');
            setNewProductTargetIngredients([]);
        } catch (e) {
            console.error("Error updating product: ", e);
            showConfirmation("Failed to update product. Please try again.", null, false);
        }
    };

    const handleDeleteProduct = (id) => {
        showConfirmation("Are you sure you want to delete this product?", async () => {
            try {
                await deleteDoc(doc(db, `${publicDataPath}/products`, id));
            }  catch (e) {
                console.error("Error deleting product: ", e);
                showConfirmation("Failed to delete product. Please try again.", null, false);
            }
        });
    };

    const handleDeleteSelectedProducts = () => {
        if (selectedProductIds.length === 0) {
            showConfirmation("No products selected for deletion.", null, false);
            return;
        }
        showConfirmation(`Are you sure you want to delete ${selectedProductIds.length} selected products?`, async () => {
            for (const id of selectedProductIds) {
                await handleDeleteProduct(id);
            }
            setSelectedProductIds([]);
        });
    };

    const handleToggleSelectProduct = (id) => {
        setSelectedProductIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleIngredientSelection = (ingredientName) => {
        setNewProductTargetIngredients(prev =>
            prev.includes(ingredientName)
                ? prev.filter(name => name !== ingredientName)
                : [...prev, ingredientName]
        );
    };


    // Mappings
    const handleAddMapping = async () => {
        if (selectedConcernForMapping.trim() === '' || selectedIngredientsForMapping.length === 0) {
            showConfirmation("Please select a concern and at least one ingredient for mapping.", null, false);
            return;
        }
        try {
            await addDoc(collection(db, `${publicDataPath}/concernIngredientMappings`), {
                concernName: selectedConcernForMapping.trim(),
                ingredientNames: selectedIngredientsForMapping,
            });
            setSelectedConcernForMapping('');
            setSelectedIngredientsForMapping([]);
        } catch (e) {
            console.error("Error adding mapping: ", e);
            showConfirmation("Failed to add mapping. Please try again.", null, false);
        }
    };

    const handleEditMapping = (mapping) => {
        setEditingMapping(mapping);
        setSelectedConcernForMapping(mapping.concernName);
        setSelectedIngredientsForMapping(mapping.ingredientNames || []);
    };

    const handleUpdateMapping = async () => {
        if (!editingMapping || selectedConcernForMapping.trim() === '' || selectedIngredientsForMapping.length === 0) {
            showConfirmation("Please select a concern and at least one ingredient for mapping.", null, false);
            return;
        }
        try {
            await setDoc(doc(db, `${publicDataPath}/concernIngredientMappings`, editingMapping.id), {
                concernName: selectedConcernForMapping.trim(),
                ingredientNames: selectedIngredientsForMapping,
            });
            setEditingMapping(null);
            setSelectedConcernForMapping('');
            setSelectedIngredientsForMapping([]);
        } catch (e) {
            console.error("Error updating mapping: ", e);
            showConfirmation("Failed to update mapping. Please try again.", null, false);
        }
    };

    const handleDeleteMapping = (id) => {
        showConfirmation("Are you sure you want to delete this mapping?", async () => {
            try {
                await deleteDoc(doc(db, `${publicDataPath}/concernIngredientMappings`, id));
            }  catch (e) {
                console.error("Error deleting mapping: ", e);
                showConfirmation("Failed to delete mapping. Please try again.", null, false);
            }
        });
    };

    const handleDeleteSelectedMappings = () => {
        if (selectedMappingIds.length === 0) {
            showConfirmation("No mappings selected for deletion.", null, false);
            return;
        }
        showConfirmation(`Are you sure you want to delete ${selectedMappingIds.length} selected mappings?`, async () => {
            for (const id of selectedMappingIds) {
                await handleDeleteMapping(id);
            }
            setSelectedMappingIds([]);
        });
    };

    const handleToggleSelectMapping = (id) => {
        setSelectedMappingIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    // New function for toggling ingredient selection for mappings
    const handleIngredientToggleForMapping = (ingredientName) => {
        setSelectedIngredientsForMapping(prev =>
            prev.includes(ingredientName)
                ? prev.filter(name => name !== ingredientName)
                : [...prev, ingredientName]
        );
    };

    // NEW: Handle Fetch Products from Shopify
    const handleFetchShopifyProducts = async () => {
        if (!shopifyStoreDomain.trim()) {
            showConfirmation("Please enter your Shopify store domain.", null, false);
            return;
        }
        // In a real application, you would NOT expose API keys client-side.
        // This is for demonstration purposes only.
        if (!shopifyApiKey.trim()) {
            showConfirmation("Please enter your Shopify API Key (for demonstration only).", null, false);
            return;
        }

        setFetchingShopifyProducts(true);
        try {
            // --- SIMULATED MOCK DATA FETCH ---
            // In a real app, you'd make a fetch call to your Shopify API proxy here.
            // Example:
            // const response = await fetch(`https://${shopifyStoreDomain}/admin/api/2023-07/products.json`, {
            //     headers: {
            //         'X-Shopify-Access-Token': shopifyApiKey,
            //     },
            // });
            // const data = await response.json();
            // const fetchedShopifyProducts = data.products.map(p => ({
            //     id: `shopify_${p.id}`,
            //     name: p.title,
            //     description: p.body_html,
            //     imageUrl: p.image ? p.image.src : '',
            //     shopifyUrl: `https://${shopifyStoreDomain}/products/${p.handle}`,
            //     targetIngredients: [], // You'd need a way to map Shopify product tags/metafields to ingredients
            // }));

            const mockShopifyProducts = [
                { id: `shopify_prod_1_${Date.now()}`, name: 'Simulated Shopify Product A', description: 'A great product from your Shopify store.', imageUrl: 'https://placehold.co/100x100/ADD8E6/000000?text=Shopify+A', shopifyUrl: `https://${shopifyStoreDomain}/products/a`, targetIngredients: [] },
                { id: `shopify_prod_2_${Date.now() + 1}`, name: 'Simulated Shopify Product B', description: 'Another fantastic Shopify item.', imageUrl: 'https://placehold.co/100x100/B0E0E6/000000?text=Shopify+B', shopifyUrl: `https://${shopifyStoreDomain}/products/b`, targetIngredients: [] },
                { id: `shopify_prod_3_${Date.now() + 2}`, name: 'Simulated Shopify Product C', description: 'Your customers will love this.', imageUrl: 'https://placehold.co/100x100/87CEEB/000000?text=Shopify+C', shopifyUrl: `https://${shopifyStoreDomain}/products/c`, targetIngredients: [] },
            ];

            await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay

            // Add fetched products to Firestore
            if (db) {
                const productsColRef = collection(db, `${publicDataPath}/products`);
                for (const prod of mockShopifyProducts) {
                    const docRef = doc(productsColRef, prod.id);
                    await setDoc(docRef, prod, { merge: true }); // Use merge to update if exists, add if new
                }
                // Firestore listener will update the 'products' state automatically
            }

            showConfirmation(`Successfully simulated fetching ${mockShopifyProducts.length} products from Shopify.`, null, false);

        } catch (error) {
            console.error("Error fetching Shopify products:", error);
            showConfirmation("Failed to fetch products from Shopify. Check your domain and API key.", null, false);
        } finally {
            setFetchingShopifyProducts(false);
        }
    };


    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 font-inter text-gray-800 flex flex-col items-center p-4 sm:p-6">
            {/* User ID Display */}
            {userId && (
                <div className="w-full max-w-4xl bg-white p-3 rounded-lg shadow-sm mb-4 text-center text-sm text-gray-600 border border-gray-200">
                    User ID: <span className="font-mono text-purple-600">{userId}</span>
                </div>
            )}

            {/* Tab Navigation - Only visible if userRole is 'admin' */}
            {userRole === 'admin' && (
                <div className="w-full max-w-4xl bg-white p-2 rounded-lg shadow-md mb-6 flex justify-center space-x-4 border border-gray-200">
                    <button
                        onClick={() => setActiveTab('customer')}
                        className={`px-6 py-2 rounded-md font-semibold transition-all duration-200 ${
                            activeTab === 'customer'
                                ? 'bg-purple-600 text-white shadow-lg'
                                : 'bg-gray-100 text-gray-700 hover:bg-purple-100'
                        }`}
                    >
                        Customer View
                    </button>
                    <button
                        onClick={() => setActiveTab('admin')}
                        className={`px-6 py-2 rounded-md font-semibold transition-all duration-200 ${
                            activeTab === 'admin'
                                ? 'bg-purple-600 text-white shadow-lg'
                                : 'bg-gray-100 text-gray-700 hover:bg-purple-100'
                        }`}
                    >
                        Admin View
                    </button>
                </div>
            )}

            {/* Main Content Area */}
            <div className="w-full max-w-4xl bg-white p-6 rounded-xl shadow-2xl border border-gray-200">
                {loading ? (
                    <div className="text-center py-10 text-lg text-purple-600">Loading application data...</div>
                ) : (
                    <>
                        {/* Customer View Content */}
                        {activeTab === 'customer' && (
                            <div className="space-y-8">
                                <h2 className="text-3xl font-bold text-purple-700 mb-6 text-center">Personalized Beauty Recommendations</h2>

                                {/* Pre-defined Concerns */}
                                <div className="mb-8 p-4 bg-purple-50 rounded-lg border border-purple-100 shadow-inner">
                                    <h3 className="text-xl font-semibold text-purple-600 mb-4">Select Your Concerns:</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                        {concerns.filter(c => c.name.toLowerCase().includes(concernFilter.toLowerCase()))
                                            .map(concern => (
                                                <button
                                                    key={concern.id}
                                                    onClick={() => handleConcernToggle(concern.name)}
                                                    className={`flex items-center justify-center px-4 py-3 rounded-lg border-2 transition-all duration-200 text-sm sm:text-base ${
                                                        selectedConcerns.includes(concern.name)
                                                            ? 'bg-purple-600 text-white border-purple-700 shadow-md transform scale-105'
                                                            : 'bg-white text-gray-700 border-gray-300 hover:border-purple-300 hover:shadow-sm'
                                                    }`}
                                                >
                                                    {selectedConcerns.includes(concern.name) && <CheckCircle className="w-5 h-5 mr-2" />}
                                                    {concern.name}
                                                </button>
                                            ))}
                                    </div>
                                </div>

                                {/* Custom Concern Input */}
                                <div className="mb-8 p-4 bg-pink-50 rounded-lg border border-pink-100 shadow-inner">
                                    <h3 className="text-xl font-semibold text-pink-600 mb-4">Or Enter Your Own Concern:</h3>
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        <input
                                            type="text"
                                            value={customConcernInput}
                                            onChange={(e) => {
                                                setCustomConcernInput(e.target.value);
                                                setSelectedConcerns([]); // Clear pre-defined selections when typing custom
                                                setCurrentCustomerConcern(''); // Clear current source when typing
                                            }}
                                            placeholder="e.g., 'Dullness and uneven texture'"
                                            className="flex-grow px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all duration-200"
                                        />
                                        <button
                                            onClick={() => handleGenerateRecommendationsForCustomer(customConcernInput)}
                                            className="px-6 py-3 bg-pink-500 text-white font-semibold rounded-lg shadow-md hover:bg-pink-600 transition-colors flex items-center justify-center whitespace-nowrap"
                                        >
                                            <Sparkles className="w-5 h-5 mr-2" /> Get Recommendations
                                        </button>
                                    </div>
                                </div>


                                {/* Recommendations Display */}
                                {(recommendedIngredients.length > 0 || recommendedProducts.length > 0) && (
                                    <div className="p-6 bg-yellow-50 rounded-lg border border-yellow-200 shadow-lg">
                                        <h3 className="text-2xl font-bold text-yellow-800 mb-6 text-center">
                                            Recommendations for {currentCustomerConcern || selectedConcerns.join(', ')}
                                        </h3>

                                        {recommendedIngredients.length > 0 && (
                                            <div className="mb-8">
                                                <h4 className="text-xl font-semibold text-yellow-800 mb-4 flex items-center">
                                                    <Brain className="w-6 h-6 mr-2" /> Recommended Ingredients:
                                                </h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    {recommendedIngredients.map(ingredient => (
                                                        <div
                                                            key={ingredient.id}
                                                            className={`p-4 rounded-lg border-2 ${
                                                                newlyAddedAIIngredientIds.includes(ingredient.id)
                                                                    ? 'bg-blue-100 border-blue-600 animate-pulse' // Highlight new AI ingredients
                                                                    : 'bg-white border-yellow-200'
                                                            } shadow-sm`}
                                                        >
                                                            <h5 className="font-bold text-lg text-gray-800">{ingredient.name}</h5>
                                                            <p className="text-gray-600 text-sm mt-1">{ingredient.description}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {recommendedProducts.length > 0 && (
                                            <div>
                                                <h4 className="text-xl font-semibold text-yellow-800 mb-4 flex items-center">
                                                    <Link className="w-6 h-6 mr-2" /> Recommended Products:
                                                </h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    {recommendedProducts.map(product => (
                                                        <div key={product.id} className="p-4 bg-white rounded-lg border border-yellow-200 shadow-sm flex items-center space-x-4">
                                                            <img
                                                                src={product.imageUrl || `https://placehold.co/100x100/ADD8E6/000000?text=${product.name}`}
                                                                alt={product.name}
                                                                className="w-20 h-20 rounded-md object-cover border border-gray-200"
                                                                onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/100x100/CCCCCC/000000?text=Image+Error`; }}
                                                            />
                                                            <div className="flex-grow">
                                                                <h5 className="font-bold text-lg text-gray-800">{product.name}</h5>
                                                                <p className="text-gray-600 text-sm mt-1">{product.description}</p>
                                                                {product.shopifyUrl && (
                                                                    <a
                                                                        href={product.shopifyUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center text-purple-600 hover:text-purple-700 text-sm mt-2 font-semibold"
                                                                    >
                                                                        View Product <Link className="w-4 h-4 ml-1" />
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Admin View Content - Only visible if activeTab is 'admin' */}
                        {activeTab === 'admin' && (
                            <div className="space-y-8">
                                <h2 className="text-3xl font-bold text-purple-700 mb-6 text-center">Admin Dashboard</h2>

                                {/* Admin Sub-Tabs */}
                                <div className="w-full bg-gray-100 p-2 rounded-lg shadow-inner mb-6 flex justify-center space-x-4 border border-gray-200">
                                    <button
                                        onClick={() => setAdminSubTab('concerns')}
                                        className={`px-4 py-2 rounded-md font-semibold transition-all duration-200 ${
                                            adminSubTab === 'concerns'
                                                ? 'bg-purple-600 text-white shadow-md'
                                                : 'bg-gray-200 text-gray-700 hover:bg-purple-100'
                                        }`}
                                    >
                                        Concerns
                                    </button>
                                    <button
                                        onClick={() => setAdminSubTab('ingredients')}
                                        className={`px-4 py-2 rounded-md font-semibold transition-all duration-200 ${
                                            adminSubTab === 'ingredients'
                                                ? 'bg-purple-600 text-white shadow-md'
                                                : 'bg-gray-200 text-gray-700 hover:bg-purple-100'
                                        }`}
                                    >
                                        Ingredients
                                    </button>
                                    <button
                                        onClick={() => setAdminSubTab('products')}
                                        className={`px-4 py-2 rounded-md font-semibold transition-all duration-200 ${
                                            adminSubTab === 'products'
                                                ? 'bg-purple-600 text-white shadow-md'
                                                : 'bg-gray-200 text-gray-700 hover:bg-purple-100'
                                        }`}
                                    >
                                        Products
                                    </button>
                                    <button
                                        onClick={() => setAdminSubTab('mappings')}
                                        className={`px-4 py-2 rounded-md font-semibold transition-all duration-200 ${
                                            adminSubTab === 'mappings'
                                                ? 'bg-purple-600 text-white shadow-md'
                                                : 'bg-gray-200 text-gray-700 hover:bg-purple-100'
                                        }`}
                                    >
                                        Mappings
                                    </button>
                                </div>

                                {/* Admin Sub-Tab Content */}
                                {adminSubTab === 'concerns' && (
                                    <div className="space-y-6">
                                        <h3 className="text-2xl font-bold text-purple-600 mb-4">Manage Concerns</h3>
                                        {/* Add Concern Form */}
                                        <div className="p-4 bg-purple-50 rounded-lg border border-purple-100 shadow-inner">
                                            <h4 className="text-lg font-semibold text-purple-700 mb-3">{editingConcern ? 'Edit Concern' : 'Add New Concern'}</h4>
                                            <div className="flex flex-col sm:flex-row gap-3 items-end">
                                                <input
                                                    type="text"
                                                    value={newConcernName}
                                                    onChange={(e) => setNewConcernName(e.target.value)}
                                                    placeholder="Enter concern name"
                                                    className="flex-grow px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all duration-200"
                                                />
                                                <button
                                                    onClick={editingConcern ? handleUpdateConcern : handleAddConcern}
                                                    className="px-5 py-2 bg-purple-600 text-white font-semibold rounded-md shadow-md hover:bg-purple-700 transition-colors flex items-center justify-center whitespace-nowrap"
                                                >
                                                    {editingConcern ? <Save className="w-5 h-5 mr-2" /> : <PlusCircle className="w-5 h-5 mr-2" />}
                                                    {editingConcern ? 'Update Concern' : 'Add Concern'}
                                                </button>
                                                {editingConcern && (
                                                    <button
                                                        onClick={() => { setEditingConcern(null); setNewConcernName(''); }}
                                                        className="px-4 py-2 bg-gray-300 text-gray-800 font-semibold rounded-md shadow-md hover:bg-gray-400 transition-colors flex items-center justify-center whitespace-nowrap"
                                                    >
                                                        <X className="w-5 h-5 mr-2" /> Cancel
                                                    </button>
                                                )}
                                            </div>
                                            {/* NEW: AI Suggest Concerns Button */}
                                            <div className="mt-4 flex justify-end">
                                                <button
                                                    onClick={handleGenerateConcernSuggestions}
                                                    disabled={generatingConcernSuggestions}
                                                    className="px-4 py-2 bg-blue-500 text-white font-semibold rounded-md shadow-md hover:bg-blue-600 transition-colors flex items-center justify-center text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {generatingConcernSuggestions ? (
                                                        <span className="flex items-center">
                                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                            </svg>
                                                            Generating...
                                                        </span>
                                                    ) : (
                                                        <>
                                                            <Brain className="w-4 h-4 mr-2" /> AI Suggest Concerns
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                            {/* NEW: Display AI Suggested Concerns */}
                                            {aiSuggestedConcernNames.length > 0 && (
                                                <div className="mt-4 p-3 bg-blue-100 rounded-lg border border-blue-200">
                                                    <p className="text-sm font-semibold text-blue-800 mb-2">AI Suggestions:</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {aiSuggestedConcernNames.map((suggestion, index) => (
                                                            <button
                                                                key={index}
                                                                onClick={() => setNewConcernName(suggestion)}
                                                                className="px-3 py-1 bg-blue-200 text-blue-800 rounded-full text-xs hover:bg-blue-300 transition-colors"
                                                            >
                                                                {suggestion}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Concern List */}
                                        <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-md">
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="text-lg font-semibold text-gray-800">Existing Concerns ({concerns.length})</h4>
                                                <input
                                                    type="text"
                                                    value={concernFilter}
                                                    onChange={(e) => setConcernFilter(e.target.value)}
                                                    placeholder="Filter concerns..."
                                                    className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-purple-500 outline-none"
                                                />
                                            </div>
                                            {selectedConcernIds.length > 0 && (
                                                <button
                                                    onClick={handleDeleteSelectedConcerns}
                                                    className="mb-4 px-4 py-2 bg-red-600 text-white font-semibold rounded-md shadow-md hover:bg-red-700 transition-colors flex items-center justify-center text-sm"
                                                >
                                                    <Trash2 className="w-4 h-4 mr-2" /> Delete Selected ({selectedConcernIds.length})
                                                </button>
                                            )}
                                            <ul className="space-y-2">
                                                {concerns
                                                    .filter(c => c.name.toLowerCase().includes(concernFilter.toLowerCase()))
                                                    .map(concern => (
                                                        <li key={concern.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200 shadow-sm">
                                                            <div className="flex items-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedConcernIds.includes(concern.id)}
                                                                    onChange={() => handleToggleSelectConcern(concern.id)}
                                                                    className="mr-3 h-4 w-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                                                                />
                                                                <span className="font-medium text-gray-700">{concern.name}</span>
                                                            </div>
                                                            <div className="flex space-x-2">
                                                                <button onClick={() => handleEditConcern(concern)} className="text-blue-600 hover:text-blue-800 transition-colors">
                                                                    <Edit className="w-5 h-5" />
                                                                </button>
                                                                <button onClick={() => showConfirmation("Are you sure you want to delete this concern?", () => handleDeleteConcern(concern.id))} className="text-red-600 hover:text-red-800 transition-colors">
                                                                    <Trash2 className="w-5 h-5" />
                                                                </button>
                                                            </div>
                                                        </li>
                                                    ))}
                                            </ul>
                                            {concerns.length === 0 && <p className="text-center text-gray-500 py-4">No concerns added yet.</p>}
                                        </div>
                                    </div>
                                )}

                                {adminSubTab === 'ingredients' && (
                                    <div className="space-y-6">
                                        <h3 className="text-2xl font-bold text-purple-600 mb-4">Manage Ingredients</h3>
                                        {/* Add Ingredient Form */}
                                        <div className="p-4 bg-purple-50 rounded-lg border border-purple-100 shadow-inner">
                                            <h4 className="text-lg font-semibold text-purple-700 mb-3">{editingIngredient ? 'Edit Ingredient' : 'Add New Ingredient'}</h4>
                                            <div className="flex flex-col gap-3">
                                                <input
                                                    type="text"
                                                    value={newIngredientName}
                                                    onChange={(e) => setNewIngredientName(e.target.value)}
                                                    placeholder="Ingredient Name"
                                                    className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all duration-200"
                                                />
                                                <textarea
                                                    value={newIngredientDescription}
                                                    onChange={(e) => setNewIngredientDescription(e.target.value)}
                                                    placeholder="Ingredient Description"
                                                    rows="3"
                                                    className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all duration-200"
                                                ></textarea>
                                                <div className="flex gap-3 justify-end">
                                                    <button
                                                        onClick={editingIngredient ? handleUpdateIngredient : () => handleAddIngredient(newIngredientName, newIngredientDescription)}
                                                        className="px-5 py-2 bg-purple-600 text-white font-semibold rounded-md shadow-md hover:bg-purple-700 transition-colors flex items-center justify-center whitespace-nowrap"
                                                    >
                                                        {editingIngredient ? <Save className="w-5 h-5 mr-2" /> : <PlusCircle className="w-5 h-5 mr-2" />}
                                                        {editingIngredient ? 'Update Ingredient' : 'Add Ingredient'}
                                                    </button>
                                                    {editingIngredient && (
                                                        <button
                                                            onClick={() => { setNewIngredientName(''); setNewIngredientDescription(''); }}
                                                            className="px-4 py-2 bg-gray-300 text-gray-800 font-semibold rounded-md shadow-md hover:bg-gray-400 transition-colors flex items-center justify-center whitespace-nowrap"
                                                        >
                                                            <X className="w-5 h-5 mr-2" /> Cancel
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Ingredient List */}
                                        <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-md">
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="text-lg font-semibold text-gray-800">Existing Ingredients ({ingredients.length})</h4>
                                                <input
                                                    type="text"
                                                    value={ingredientFilter}
                                                    onChange={(e) => setIngredientFilter(e.target.value)}
                                                    placeholder="Filter ingredients..."
                                                    className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-purple-500 outline-none"
                                                />
                                            </div>
                                            {selectedIngredientIds.length > 0 && (
                                                <button
                                                    onClick={handleDeleteSelectedIngredients}
                                                    className="mb-4 px-4 py-2 bg-red-600 text-white font-semibold rounded-md shadow-md hover:bg-red-700 transition-colors flex items-center justify-center text-sm"
                                                >
                                                    <Trash2 className="w-4 h-4 mr-2" /> Delete Selected ({selectedIngredientIds.length})
                                                </button>
                                            )}
                                            <ul className="space-y-2">
                                                {ingredients
                                                    .filter(i => i.name.toLowerCase().includes(ingredientFilter.toLowerCase()))
                                                    .map(ingredient => (
                                                        <li key={ingredient.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200 shadow-sm">
                                                            <div className="flex items-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedIngredientIds.includes(ingredient.id)}
                                                                    onChange={() => handleToggleSelectIngredient(ingredient.id)}
                                                                    className="mr-3 h-4 w-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                                                                />
                                                                <div>
                                                                    <span className="font-medium text-gray-700">{ingredient.name}</span>
                                                                    {ingredient.description && <p className="text-gray-500 text-sm">{ingredient.description}</p>}
                                                                </div>
                                                            </div>
                                                            <div className="flex space-x-2">
                                                                <button onClick={() => handleEditIngredient(ingredient)} className="text-blue-600 hover:text-blue-800 transition-colors">
                                                                    <Edit className="w-5 h-5" />
                                                                </button>
                                                                <button onClick={() => handleDeleteIngredient(ingredient.id)} className="text-red-600 hover:text-red-800 transition-colors">
                                                                    <Trash2 className="w-5 h-5" />
                                                                </button>
                                                            </div>
                                                        </li>
                                                    ))}
                                            </ul>
                                            {ingredients.length === 0 && <p className="text-center text-gray-500 py-4">No ingredients added yet.</p>}
                                        </div>
                                    </div>
                                )}

                                {adminSubTab === 'products' && (
                                    <div className="space-y-6">
                                        <h3 className="text-2xl font-bold text-purple-600 mb-4">Manage Products</h3>
                                        {/* NEW: Shopify Integration Section */}
                                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 shadow-inner">
                                            <h4 className="text-lg font-semibold text-blue-700 mb-3">Fetch Products from Shopify</h4>
                                            <p className="text-sm text-gray-600 mb-4">
                                                Enter your Shopify store domain and a **Storefront Access Token** (for client-side fetching) to import products.
                                                <br />
                                                <span className="font-bold text-red-600">Warning:</span> Exposing API keys client-side is NOT secure for production. Use a backend for real integration.
                                            </p>
                                            <div className="flex flex-col sm:flex-row gap-3 mb-4">
                                                <input
                                                    type="text"
                                                    value={shopifyStoreDomain}
                                                    onChange={(e) => setShopifyStoreDomain(e.target.value)}
                                                    placeholder="your-store-name.myshopify.com"
                                                    className="flex-grow px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
                                                />
                                                <input
                                                    type="password" // Use type="password" for API keys
                                                    value={shopifyApiKey}
                                                    onChange={(e) => setShopifyApiKey(e.target.value)}
                                                    placeholder="Shopify Storefront Access Token"
                                                    className="flex-grow px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
                                                />
                                                <button
                                                    onClick={handleFetchShopifyProducts}
                                                    disabled={fetchingShopifyProducts}
                                                    className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-md shadow-md hover:bg-blue-700 transition-colors flex items-center justify-center whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {fetchingShopifyProducts ? (
                                                        <span className="flex items-center">
                                                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                            </svg>
                                                            Fetching...
                                                        </span>
                                                    ) : (
                                                        <>
                                                            <Download className="w-5 h-5 mr-2" /> Fetch Products
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Add Product Form */}
                                        <div className="p-4 bg-purple-50 rounded-lg border border-purple-100 shadow-inner">
                                            <h4 className="text-lg font-semibold text-purple-700 mb-3">{editingProduct ? 'Edit Product' : 'Add New Product'}</h4>
                                            <div className="flex flex-col gap-3">
                                                <input
                                                    type="text"
                                                    value={newProductName}
                                                    onChange={(e) => setNewProductName(e.target.value)}
                                                    placeholder="Product Name"
                                                    className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all duration-200"
                                                />
                                                <textarea
                                                    value={newProductDescription}
                                                    onChange={(e) => setNewProductDescription(e.target.value)}
                                                    placeholder="Product Description"
                                                    rows="3"
                                                    className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all duration-200"
                                                ></textarea>
                                                <input
                                                    type="text"
                                                    value={newProductImageUrl}
                                                    onChange={(e) => setNewProductImageUrl(e.target.value)}
                                                    placeholder="Image URL (e.g., https://placehold.co/100x100)"
                                                    className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400"
                                                />
                                                <input
                                                    type="text"
                                                    value={newProductShopifyUrl}
                                                    onChange={(e) => setNewProductShopifyUrl(e.target.value)}
                                                    placeholder="Shopify Product URL"
                                                    className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400"
                                                />
                                                {/* Ingredient Multi-Select for Products */}
                                                <div className="relative">
                                                    <label className="block text-gray-700 text-sm font-bold mb-2">Target Ingredients:</label>
                                                    <div className="flex flex-wrap gap-2 p-2 border border-gray-300 rounded-md bg-white">
                                                        {ingredients.map(ingredient => (
                                                            <button
                                                                key={ingredient.id}
                                                                onClick={() => handleIngredientSelection(ingredient.name)}
                                                                className={`px-3 py-1 rounded-full text-sm transition-colors duration-200 ${
                                                                    newProductTargetIngredients.includes(ingredient.name)
                                                                        ? 'bg-purple-200 text-purple-800'
                                                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                                }`}
                                                            >
                                                                {ingredient.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="flex gap-3 justify-end">
                                                    <button
                                                        onClick={editingProduct ? handleUpdateProduct : handleAddProduct}
                                                        className="px-5 py-2 bg-purple-600 text-white font-semibold rounded-md shadow-md hover:bg-purple-700 transition-colors flex items-center justify-center whitespace-nowrap"
                                                    >
                                                        {editingProduct ? <Save className="w-5 h-5 mr-2" /> : <PlusCircle className="w-5 h-5 mr-2" />}
                                                        {editingProduct ? 'Update Product' : 'Add Product'}
                                                    </button>
                                                    {editingProduct && (
                                                        <button
                                                            onClick={() => { setNewProductName(''); setNewProductDescription(''); setNewProductImageUrl(''); setNewProductShopifyUrl(''); setNewProductTargetIngredients([]); }}
                                                            className="px-4 py-2 bg-gray-300 text-gray-800 font-semibold rounded-md shadow-md hover:bg-gray-400 transition-colors flex items-center justify-center whitespace-nowrap"
                                                        >
                                                            <X className="w-5 h-5 mr-2" /> Cancel
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Product List */}
                                        <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-md">
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="text-lg font-semibold text-gray-800">Existing Products ({products.length})</h4>
                                                <input
                                                    type="text"
                                                    value={productFilter}
                                                    onChange={(e) => setProductFilter(e.target.value)}
                                                    placeholder="Filter products..."
                                                    className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-purple-500 outline-none"
                                                />
                                            </div>
                                            {selectedProductIds.length > 0 && (
                                                <button
                                                    onClick={handleDeleteSelectedProducts}
                                                    className="mb-4 px-4 py-2 bg-red-600 text-white font-semibold rounded-md shadow-md hover:bg-red-700 transition-colors flex items-center justify-center text-sm"
                                                >
                                                    <Trash2 className="w-4 h-4 mr-2" /> Delete Selected ({selectedProductIds.length})
                                                </button>
                                            )}
                                            <ul className="space-y-2">
                                                {products
                                                    .filter(p => p.name.toLowerCase().includes(productFilter.toLowerCase()))
                                                    .map(product => (
                                                        <li key={product.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200 shadow-sm">
                                                            <div className="flex items-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedProductIds.includes(product.id)}
                                                                    onChange={() => handleToggleSelectProduct(product.id)}
                                                                    className="mr-3 h-4 w-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                                                                />
                                                                <img
                                                                    src={product.imageUrl || `https://placehold.co/50x50/ADD8E6/000000?text=Prod`}
                                                                    alt={product.name}
                                                                    className="w-12 h-12 rounded-md object-cover mr-3 border border-gray-200"
                                                                    onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/50x50/CCCCCC/000000?text=Error`; }}
                                                                />
                                                                <div>
                                                                    <span className="font-medium text-gray-700">{product.name}</span>
                                                                    {product.description && <p className="text-gray-500 text-sm truncate w-48">{product.description}</p>}
                                                                    {product.targetIngredients && product.targetIngredients.length > 0 && (
                                                                        <p className="text-gray-500 text-xs mt-1">Key: {product.targetIngredients.join(', ')}</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex space-x-2">
                                                                <button onClick={() => handleEditProduct(product)} className="text-blue-600 hover:text-blue-800 transition-colors">
                                                                    <Edit className="w-5 h-5" />
                                                                </button>
                                                                <button onClick={() => handleDeleteProduct(product.id)} className="text-red-600 hover:text-red-800 transition-colors">
                                                                    <Trash2 className="w-5 h-5" />
                                                                </button>
                                                            </div>
                                                        </li>
                                                    ))}
                                            </ul>
                                            {products.length === 0 && <p className="text-center text-gray-500 py-4">No products added yet.</p>}
                                        </div>
                                    </div>
                                )}

                                {adminSubTab === 'mappings' && (
                                    <div className="space-y-6">
                                        <h3 className="text-2xl font-bold text-purple-600 mb-4">Manage Concern-Ingredient Mappings</h3>
                                        {/* Add/Edit Mapping Form */}
                                        <div className="p-4 bg-purple-50 rounded-lg border border-purple-100 shadow-inner">
                                            <h4 className="text-lg font-semibold text-purple-700 mb-3">{editingMapping ? 'Edit Mapping' : 'Add New Mapping'}</h4>
                                            <div className="flex flex-col gap-3">
                                                <select
                                                    value={selectedConcernForMapping}
                                                    onChange={(e) => {
                                                        setSelectedConcernForMapping(e.target.value);
                                                        setAiSuggestedIngredientsForMappingTab([]); // Clear AI suggestions when concern changes
                                                    }}
                                                    className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all duration-200"
                                                >
                                                    <option value="">Select Concern</option>
                                                    {concerns.map(concern => (
                                                        <option key={concern.id} value={concern.name}>{concern.name}</option>
                                                    ))}
                                                </select>

                                                {/* NEW: AI Suggest Ingredients for Mapping Button */}
                                                {selectedConcernForMapping && (
                                                    <button
                                                        onClick={async () => {
                                                            setGeneratingAIIngredientsForMappingTab(true);
                                                            setAiSuggestedIngredientsForMappingTab([]); // Clear previous suggestions
                                                            const prompt = `Given the beauty concern: "${selectedConcernForMapping}", what are the top 3-5 key skincare ingredients that would effectively address this? Provide only the ingredient names, separated by commas. For example: "Ingredient1, Ingredient2".`;

                                                            try {
                                                                if (typeof getFunctions === 'undefined' || !functions) {
                                                                    showConfirmation("Cloud Functions not initialized. Cannot generate AI suggestions.", null, false);
                                                                    return;
                                                                }
                                                                const geminiApiKey = process.env.REACT_APP_GEMINI_API_KEY;
                                                                if (!geminiApiKey) {
                                                                    showConfirmation("Gemini API Key is not configured. Please contact support.", null, false);
                                                                    return;
                                                                }

                                                                const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
                                                                const payload = { contents: chatHistory };
                                                                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;

                                                                const response = await fetch(apiUrl, {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify(payload)
                                                                });

                                                                const result = await response.json();

                                                                if (result.candidates && result.candidates.length > 0 &&
                                                                    result.candidates[0].content && result.candidates[0].content.parts &&
                                                                    result.candidates[0].content.parts.length > 0) {
                                                                    const text = result.candidates[0].content.parts[0].text;
                                                                    const suggestions = text.split(',').map(s => s.trim()).filter(s => s !== '');
                                                                    setAiSuggestedIngredientsForMappingTab(suggestions);
                                                                } else {
                                                                    showConfirmation("No AI suggestions found. Please try again.", null, false);
                                                                }
                                                            } catch (error) {
                                                                console.error("Error generating AI ingredient suggestions:", error);
                                                                showConfirmation("Failed to get AI suggestions. Please try again.", null, false);
                                                            } finally {
                                                                setGeneratingAIIngredientsForMappingTab(false);
                                                            }
                                                        }}
                                                        disabled={generatingAIIngredientsForMappingTab}
                                                        className="px-5 py-2 bg-blue-500 text-white font-semibold rounded-md shadow-md hover:bg-blue-600 transition-colors flex items-center justify-center whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {generatingAIIngredientsForMappingTab ? (
                                                            <span className="flex items-center">
                                                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                </svg>
                                                                Generating...
                                                            </span>
                                                        ) : (
                                                            <>
                                                                <Lightbulb className="w-5 h-5 mr-2" /> Suggest Ingredients (AI)
                                                            </>
                                                        )}
                                                    </button>
                                                )}

                                                {/* NEW: Display AI Suggested Ingredients for Mapping */}
                                                {aiSuggestedIngredientsForMappingTab.length > 0 && (
                                                    <div className="mt-4 p-3 bg-blue-100 rounded-lg border border-blue-200">
                                                        <p className="text-sm font-semibold text-blue-800 mb-2">AI Suggestions for "{selectedConcernForMapping}":</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {aiSuggestedIngredientsForMappingTab.map((ingredient, index) => (
                                                                <button
                                                                    key={index} // Using index as key is okay for static lists without reordering
                                                                    onClick={() => handleIngredientToggleForMapping(ingredient)} // Directly add to selectedIngredientsForMapping
                                                                    className={`px-3 py-1 rounded-full text-sm transition-colors duration-200 ${
                                                                        selectedIngredientsForMapping.includes(ingredient)
                                                                            ? 'bg-purple-200 text-purple-800'
                                                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                                    }`}
                                                                >
                                                                    {ingredient}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="relative">
                                                    <label className="block text-gray-700 text-sm font-bold mb-2">Select Ingredients:</label>
                                                    <div className="flex flex-wrap gap-2 p-2 border border-gray-300 rounded-md bg-white">
                                                        {ingredients.map(ingredient => (
                                                            <button
                                                                key={ingredient.id}
                                                                onClick={() => handleIngredientToggleForMapping(ingredient.name)}
                                                                className={`px-3 py-1 rounded-full text-sm transition-colors duration-200 ${
                                                                    selectedIngredientsForMapping.includes(ingredient.name)
                                                                        ? 'bg-pink-200 text-pink-800'
                                                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                                }`}
                                                            >
                                                                {ingredient.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="flex gap-3 justify-end">
                                                    <button
                                                        onClick={editingMapping ? handleUpdateMapping : handleAddMapping}
                                                        className="px-5 py-2 bg-purple-600 text-white font-semibold rounded-md shadow-md hover:bg-purple-700 transition-colors flex items-center justify-center whitespace-nowrap"
                                                    >
                                                        {editingMapping ? <Save className="w-5 h-5 mr-2" /> : <PlusCircle className="w-5 h-5 mr-2" />}
                                                        {editingMapping ? 'Update Mapping' : 'Add Mapping'}
                                                    </button>
                                                    {editingMapping && (
                                                        <button
                                                            onClick={() => { setEditingMapping(null); setSelectedConcernForMapping(''); setSelectedIngredientsForMapping([]); setAiSuggestedIngredientsForMappingTab([]); }}
                                                            className="px-4 py-2 bg-gray-300 text-gray-800 font-semibold rounded-md shadow-md hover:bg-gray-400 transition-colors flex items-center justify-center whitespace-nowrap"
                                                        >
                                                            <X className="w-5 h-5 mr-2" /> Cancel
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Mapping List */}
                                        <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-md">
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="text-lg font-semibold text-gray-800">Existing Mappings ({concernIngredientMappings.length})</h4>
                                                <input
                                                    type="text"
                                                    value={mappingFilter}
                                                    onChange={(e) => setMappingFilter(e.target.value)}
                                                    placeholder="Filter mappings..."
                                                    className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-purple-500 outline-none"
                                                />
                                            </div>
                                            {selectedMappingIds.length > 0 && (
                                                <button
                                                    onClick={handleDeleteSelectedMappings}
                                                    className="mb-4 px-4 py-2 bg-red-600 text-white font-semibold rounded-md shadow-md hover:bg-red-700 transition-colors flex items-center justify-center text-sm"
                                                >
                                                    <Trash2 className="w-4 h-4 mr-2" /> Delete Selected ({selectedMappingIds.length})
                                                </button>
                                            )}
                                            <ul className="space-y-2">
                                                {concernIngredientMappings
                                                    .filter(m => m.concernName.toLowerCase().includes(mappingFilter.toLowerCase()) ||
                                                        (m.ingredientNames && m.ingredientNames.some(ing => ing.toLowerCase().includes(mappingFilter.toLowerCase()))))
                                                    .map(mapping => (
                                                        <li key={mapping.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200 shadow-sm">
                                                            <div className="flex items-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedMappingIds.includes(mapping.id)}
                                                                    onChange={() => handleToggleSelectMapping(mapping.id)}
                                                                    className="mr-3 h-4 w-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                                                                />
                                                                <div>
                                                                    <span className="font-medium text-gray-700">{mapping.concernName}</span>
                                                                    {/* This is where the ingredients are displayed */}
                                                                    {mapping.ingredientNames && mapping.ingredientNames.length > 0 && (
                                                                        <p className="text-gray-500 text-sm">Ingredients: {mapping.ingredientNames.join(', ')}</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex space-x-2">
                                                                <button onClick={() => handleEditMapping(mapping)} className="text-blue-600 hover:text-blue-800 transition-colors">
                                                                    <Edit className="w-5 h-5" />
                                                                </button>
                                                                <button onClick={() => handleDeleteMapping(mapping.id)} className="text-red-600 hover:text-red-800 transition-colors">
                                                                    <Trash2 className="w-5 h-5" />
                                                                </button>
                                                            </div>
                                                        </li>
                                                    ))}
                                            </ul>
                                            {concernIngredientMappings.length === 0 && <p className="text-center text-gray-500 py-4">No mappings added yet.</p>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Admin Login/Logout Button (for development/testing) */}
            <div className="mt-8 text-center">
                {userRole === 'customer' ? (
                    <button
                        onClick={() => setUserRole('admin')}
                        className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg shadow-md hover:bg-gray-300 transition-colors"
                    >
                        Switch to Admin View (Dev Mode)
                    </button>
                ) : (
                    <button
                        onClick={() => { setUserRole('customer'); setActiveTab('customer'); }}
                        className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg shadow-md hover:bg-gray-300 transition-colors"
                    >
                        Switch to Customer View
                    </button>
                )}
            </div>

            {/* Confirmation Modal Portal */}\
            {showConfirmModal && ReactDOM.createPortal(
                <ConfirmationModal
                    message={confirmMessage}
                    onConfirm={handleConfirm}
                    onCancel={handleCancelConfirm}
                    showCancel={confirmShowCancel}
                />,
                document.body
            )}
        </div>
    );
};

export default App;

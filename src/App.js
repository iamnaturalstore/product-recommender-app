/* global __initial_auth_token */ // __initial_auth_token is still a Canvas global for specific auth scenarios
import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom'; // Import ReactDOM for portals
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
// eslint-disable-next-line no-unused-vars
import { getFirestore, collection, query, onSnapshot, doc, setDoc, addDoc, deleteDoc, getDocs } from 'firebase/firestore';
// Removed XCircle, Search, Settings, Filter as they were unused based on ESLint report
import { CheckCircle, Sparkles, PlusCircle, Edit, Trash2, Save, X, Link, Brain, Download } from 'lucide-react'; // Added Download icon

// IMPORTANT: For Netlify deployment, environment variables are accessed via process.env
// and need to be prefixed with REACT_APP_ (e.g., REACT_APP_APP_ID, REACT_APP_FIREBASE_CONFIG).\
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
let app, db, auth;
// Added a check to ensure firebaseConfig is a non-empty object with projectId before initializing
if (Object.keys(firebaseConfig).length > 0 && firebaseConfig.projectId) {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
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

    // NEW STATE for AI suggested ingredients for mapping
    const [aiSuggestedMappingIngredients, setAiSuggestedMappingIngredients] = useState([]);
    const [generatingMappingIngredientSuggestions, setGeneratingMappingIngredientSuggestions] = useState(false);


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
        setCurrentCustomerConcern(''); // Clear current source when typing
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
            } catch (e) {
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
            setAiSuggestedMappingIngredients([]); // Clear AI suggestions after adding
        } catch (e) {
            console.error("Error adding mapping: ", e);
            showConfirmation("Failed to add mapping. Please try again.", null, false);
        }
    };

    const handleEditMapping = (mapping) => {
        setEditingMapping(mapping);
        setSelectedConcernForMapping(mapping.concernName);
        setSelectedIngredientsForMapping(mapping.ingredientNames || []);
        setAiSuggestedMappingIngredients([]); // Clear AI suggestions when editing existing
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
            setAiSuggestedMappingIngredients([]); // Clear AI suggestions after updating
        } catch (e) {
            console.error("Error updating mapping: ", e);
            showConfirmation("Failed to update mapping. Please try again.", null, false);
        }
    };

    const handleDeleteMapping = (id) => {
        showConfirmation("Are you sure you want to delete this mapping?", async () => {
            try {
                await deleteDoc(doc(db, `${publicDataPath}/concernIngredientMappings`, id));
            } catch (e) {
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

    // NEW: Function to generate AI ingredient suggestions for Mapping tab
    const handleGenerateAIIngredientSuggestionsForMapping = async () => {
        if (!selectedConcernForMapping) {
            showConfirmation("Please select a concern first to get ingredient suggestions.", null, false);
            return;
        }

        setGeneratingMappingIngredientSuggestions(true);
        setAiSuggestedMappingIngredients([]); // Clear previous suggestions

        const prompt = `Given the beauty concern: "${selectedConcernForMapping}", what are 3-5 key skincare ingredients that would effectively address this? Provide only the ingredient names, separated by commas. For example: "Salicylic Acid, Niacinamide, Hyaluronic Acid".`;

        try {
            const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
            if (!apiKey) {
                showConfirmation("Gemini API Key is not configured. Please contact support.", null, false);
                setGeneratingMappingIngredientSuggestions(false);
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
                setAiSuggestedMappingIngredients(suggestions);
            } else {
                showConfirmation("No AI ingredient suggestions found. Please try again.", null, false);
            }
        } catch (error) {
            console.error("Error generating AI ingredient suggestions for mapping:", error);
            showConfirmation("Failed to get AI ingredient suggestions. Please try again.", null, false);
        } finally {
            setGeneratingMappingIngredientSuggestions(false);
        }
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

            // Updated mock data for more realistic simulation
            const mockShopifyProducts = [
                {
                    id: `shopify_prod_1_${Date.now()}`,
                    name: 'Hydrating Face Serum with Hyaluronic Acid',
                    description: 'A lightweight serum designed to deeply hydrate and plump the skin, reducing the appearance of fine lines.',
                    imageUrl: 'https://placehold.co/100x100/AEC6CF/000000?text=Hydrating+Serum',
                    shopifyUrl: `https://${shopifyStoreDomain}/products/hydrating-serum`,
                    targetIngredients: ['Hyaluronic Acid']
                },
                {
                    id: `shopify_prod_2_${Date.now() + 1}`,
                    name: 'Acne Spot Treatment with Salicylic Acid',
                    description: 'Fast-acting spot treatment to clear breakouts and prevent new ones with salicylic acid.',
                    imageUrl: 'https://placehold.co/100x100/FFD700/000000?text=Acne+Treatment',
                    shopifyUrl: `https://${shopifyStoreDomain}/products/acne-treatment`,
                    targetIngredients: ['Salicylic Acid']
                },
                {
                    id: `shopify_prod_3_${Date.now() + 2}`,
                    name: 'Brightening Vitamin C Cream',
                    description: 'Visibly brightens and evens skin tone while providing antioxidant protection.',
                    imageUrl: 'https://placehold.co/100x100/FFB6C1/000000?text=Vitamin+C+Cream',
                    shopifyUrl: `https://${shopifyStoreDomain}/products/vitamin-c-cream`,
                    targetIngredients: ['Vitamin C']
                },
                {
                    id: `shopify_prod_4_${Date.now() + 3}`,
                    name: 'Niacinamide Redness Relief Toner',
                    description: 'A soothing toner formulated with Niacinamide to calm redness and minimize pores.',
                    imageUrl: 'https://placehold.co/100x100/98FB98/000000?text=Niacinamide+Toner',
                    shopifyUrl: `https://${shopifyStoreDomain}/products/niacinamide-toner`,
                    targetIngredients: ['Niacinamide']
                },
                {
                    id: `shopify_prod_5_${Date.now() + 4}`,
                    name: 'Anti-Aging Retinol Night Cream',
                    description: 'Powerful night cream with Retinol to reduce the appearance of wrinkles and improve skin texture.',
                    imageUrl: 'https://placehold.co/100x100/DDA0DD/000000?text=Retinol+Cream',
                    shopifyUrl: `https://${shopifyStoreDomain}/products/retinol-cream`,
                    targetIngredients: ['Retinol']
                }
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
        <div className="min-h-screen bg-gradient-to-br from-purple-100 to-pink-100 font-inter text-gray-800 flex flex-col items-center p-4 sm:p-6">
            {/* User ID Display */}
            {userId && (
                <div className="w-full max-w-4xl bg-white p-3 rounded-xl shadow-lg mb-4 text-center text-sm text-gray-600 border border-gray-100">
                    User ID: <span className="font-mono text-purple-700 font-semibold">{userId}</span>
                </div>
            )}

            {/* Tab Navigation - Only visible if userRole is 'admin' */}
            {userRole === 'admin' && (
                <div className="w-full max-w-4xl bg-white p-2 rounded-xl shadow-xl mb-6 flex justify-center space-x-4 border border-gray-100">
                    <button
                        onClick={() => setActiveTab('customer')}
                        className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 ${
                            activeTab === 'customer'
                                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                                : 'bg-gray-50 text-gray-700 hover:bg-purple-50 hover:text-purple-700'
                        }`}
                    >
                        Customer View
                    </button>
                    <button
                        onClick={() => setActiveTab('admin')}
                        className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 ${
                            activeTab === 'admin'
                                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                                : 'bg-gray-50 text-gray-700 hover:bg-purple-50 hover:text-purple-700'
                        }`}
                    >
                        Admin View
                    </button>
                </div>
            )}

            {/* Main Content Area */}
            <div className="w-full max-w-4xl bg-white p-6 rounded-3xl shadow-2xl border border-gray-100 relative overflow-hidden">
                {/* Global Loading Indicator */}
                {loading && (
                    <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50 rounded-3xl">
                        <div className="flex flex-col items-center">
                            <svg className="animate-spin h-12 w-12 text-purple-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p className="text-purple-700 font-semibold text-lg">Loading data, please wait...</p>
                        </div>
                    </div>
                )}
                {/* End Global Loading Indicator */}

                {/* Conditional rendering based on loading state */}
                {!loading && (
                    <>
                        {/* Customer View Content */}
                        {activeTab === 'customer' && (
                            <div className="space-y-10">
                                <h2 className="text-4xl font-extrabold text-purple-800 mb-8 text-center drop-shadow-sm">Personalized Beauty Recommendations</h2>

                                {/* Pre-defined Concerns */}
                                <div className="mb-8 p-6 bg-purple-50 rounded-2xl border border-purple-200 shadow-inner">
                                    <h3 className="text-2xl font-bold text-purple-700 mb-5">Select Your Concerns:</h3>
                                    {concerns.length === 0 ? (
                                        <p className="text-center text-gray-500 py-6 text-lg">No concerns available. Please add some in the Admin View to get started!</p>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                                            {concerns.filter(c => c.name.toLowerCase().includes(concernFilter.toLowerCase()))
                                                .map(concern => (
                                                    <button
                                                        key={concern.id}
                                                        onClick={() => handleConcernToggle(concern.name)}
                                                        className={`flex items-center justify-center px-5 py-3 rounded-xl border-2 transition-all duration-300 text-base sm:text-lg font-medium transform hover:scale-105 active:scale-95 ${
                                                            selectedConcerns.includes(concern.name)
                                                                ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white border-purple-700 shadow-lg'
                                                                : 'bg-white text-gray-800 border-gray-300 hover:border-purple-400 hover:shadow-md'
                                                        }`}
                                                    >
                                                        {selectedConcerns.includes(concern.name) && <CheckCircle className="w-6 h-6 mr-2 text-white" />}
                                                        {concern.name}
                                                    </button>
                                                ))}
                                        </div>
                                    )}
                                </div>

                                {/* Custom Concern Input */}
                                <div className="mb-8 p-6 bg-pink-50 rounded-2xl border border-pink-200 shadow-inner">
                                    <h3 className="text-2xl font-bold text-pink-700 mb-5">Or Enter Your Own Concern:</h3>
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        <input
                                            type="text"
                                            value={customConcernInput}
                                            onChange={(e) => {
                                                setCustomConcernInput(e.target.value);
                                                setSelectedConcerns([]); // Clear pre-defined selections when typing custom
                                                setCurrentCustomerConcern(''); // Clear current source when typing
                                            }}
                                            placeholder="e.g., 'Dullness and uneven texture, sensitive skin'"
                                            className="flex-grow px-5 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-pink-300 focus:border-pink-500 outline-none transition-all duration-200 text-lg"
                                        />
                                        <button
                                            onClick={() => handleGenerateRecommendationsForCustomer(customConcernInput)}
                                            className="px-7 py-3 bg-gradient-to-r from-pink-500 to-red-500 text-white font-bold rounded-xl shadow-lg hover:from-pink-600 hover:to-red-600 transition-all duration-300 transform hover:scale-105 flex items-center justify-center whitespace-nowrap text-lg"
                                        >
                                            <Sparkles className="w-6 h-6 mr-2" /> Get Recommendations
                                        </button>
                                    </div>
                                </div>


                                {/* Recommendations Display */}
                                {(recommendedIngredients.length > 0 || recommendedProducts.length > 0) && (
                                    <div className="p-8 bg-yellow-50 rounded-3xl border border-yellow-300 shadow-2xl">
                                        <h3 className="text-3xl font-extrabold text-yellow-800 mb-7 text-center">
                                            Recommendations for <span className="text-purple-700">{currentCustomerConcern || selectedConcerns.join(', ')}</span>
                                        </h3>

                                        {recommendedIngredients.length > 0 && (
                                            <div className="mb-10">
                                                <h4 className="text-2xl font-bold text-yellow-800 mb-5 flex items-center">
                                                    <Brain className="w-7 h-7 mr-3 text-purple-600" /> Recommended Ingredients:
                                                </h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                                    {recommendedIngredients.map(ingredient => (
                                                        <div
                                                            key={ingredient.id}
                                                            className={`p-5 rounded-2xl border-2 transition-all duration-300 transform hover:scale-105 ${
                                                                newlyAddedAIIngredientIds.includes(ingredient.id)
                                                                    ? 'bg-blue-100 border-blue-600 animate-pulse-once shadow-xl' // Highlight new AI ingredients
                                                                    : 'bg-white border-yellow-200 shadow-md'
                                                            }`}
                                                        >
                                                            <h5 className="font-bold text-xl text-gray-900 mb-2">{ingredient.name}</h5>
                                                            <p className="text-gray-700 text-base">{ingredient.description}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {recommendedProducts.length > 0 && (
                                            <div>
                                                <h4 className="text-2xl font-bold text-yellow-800 mb-5 flex items-center">
                                                    <Link className="w-7 h-7 mr-3 text-purple-600" /> Recommended Products:
                                                </h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                                    {recommendedProducts.map(product => (
                                                        <div key={product.id} className="p-5 bg-white rounded-2xl border border-yellow-200 shadow-md flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-5 transition-all duration-300 transform hover:scale-105">
                                                            <img
                                                                src={product.imageUrl || `https://placehold.co/120x120/ADD8E6/000000?text=${product.name}`}
                                                                alt={product.name}
                                                                className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg object-cover border border-gray-200 shadow-sm flex-shrink-0"
                                                                onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/120x120/CCCCCC/000000?text=Image+Error`; }}
                                                            />
                                                            <div className="flex-grow text-center sm:text-left">
                                                                <h5 className="font-bold text-xl text-gray-900 mb-1">{product.name}</h5>
                                                                <p className="text-gray-700 text-base mt-1">{product.description}</p>
                                                                {product.targetIngredients && product.targetIngredients.length > 0 && (
                                                                    <p className="text-gray-600 text-sm mt-2 font-medium">Key Ingredients: <span className="font-normal">{product.targetIngredients.join(', ')}</span></p>
                                                                )}
                                                                {product.shopifyUrl && (
                                                                    <a
                                                                        href={product.shopifyUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center text-purple-600 hover:text-purple-800 text-base mt-3 font-semibold transition-colors duration-200"
                                                                    >
                                                                        View Product <Link className="w-5 h-5 ml-2" />
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
                            <div className="space-y-10">
                                <h2 className="text-4xl font-extrabold text-purple-800 mb-8 text-center drop-shadow-sm">Admin Dashboard</h2>

                                {/* Admin Sub-Tabs */}
                                <div className="w-full bg-gray-100 p-3 rounded-2xl shadow-lg mb-8 flex flex-wrap justify-center gap-4 border border-gray-200">
                                    <button
                                        onClick={() => setAdminSubTab('concerns')}
                                        className={`px-5 py-2 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 ${
                                            adminSubTab === 'concerns'
                                                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
                                                : 'bg-gray-200 text-gray-700 hover:bg-purple-100 hover:text-purple-700'
                                        }`}
                                    >
                                        Concerns
                                    </button>
                                    <button
                                        onClick={() => setAdminSubTab('ingredients')}
                                        className={`px-5 py-2 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 ${
                                            adminSubTab === 'ingredients'
                                                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
                                                : 'bg-gray-200 text-gray-700 hover:bg-purple-100 hover:text-purple-700'
                                        }`}
                                    >
                                        Ingredients
                                    </button>
                                    <button
                                        onClick={() => setAdminSubTab('products')}
                                        className={`px-5 py-2 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 ${
                                            adminSubTab === 'products'
                                                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
                                                : 'bg-gray-200 text-gray-700 hover:bg-purple-100 hover:text-purple-700'
                                        }`}
                                    >
                                        Products
                                    </button>
                                    <button
                                        onClick={() => setAdminSubTab('mappings')}
                                        className={`px-5 py-2 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 ${
                                            adminSubTab === 'mappings'
                                                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
                                                : 'bg-gray-200 text-gray-700 hover:bg-purple-100 hover:text-purple-700'
                                        }`}
                                    >
                                        Mappings
                                    </button>
                                </div>

                                {/* Admin Sub-Tab Content */}
                                {adminSubTab === 'concerns' && (
                                    <div className="space-y-8">
                                        <h3 className="text-3xl font-bold text-purple-700 mb-6">Manage Concerns</h3>
                                        {/* Add Concern Form */}
                                        <div className="p-6 bg-purple-50 rounded-2xl border border-purple-200 shadow-lg">
                                            <h4 className="text-xl font-semibold text-purple-800 mb-4">{editingConcern ? 'Edit Concern' : 'Add New Concern'}</h4>
                                            <div className="flex flex-col sm:flex-row gap-4 items-end">
                                                <input
                                                    type="text"
                                                    value={newConcernName}
                                                    onChange={(e) => setNewConcernName(e.target.value)}
                                                    placeholder="Enter concern name"
                                                    className="flex-grow px-5 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-purple-300 focus:border-purple-500 outline-none transition-all duration-200 text-lg"
                                                />
                                                <button
                                                    onClick={editingConcern ? handleUpdateConcern : handleAddConcern}
                                                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl shadow-md hover:from-purple-700 hover:to-pink-700 transition-all duration-300 transform hover:scale-105 flex items-center justify-center whitespace-nowrap text-base"
                                                >
                                                    {editingConcern ? <Save className="w-5 h-5 mr-2" /> : <PlusCircle className="w-5 h-5 mr-2" />}
                                                    {editingConcern ? 'Update Concern' : 'Add Concern'}
                                                </button>
                                                {editingConcern && (
                                                    <button
                                                        onClick={() => { setEditingConcern(null); setNewConcernName(''); }}
                                                        className="px-5 py-3 bg-gray-300 text-gray-800 font-semibold rounded-xl shadow-md hover:bg-gray-400 transition-all duration-200 transform hover:scale-105 flex items-center justify-center whitespace-nowrap text-base"
                                                    >
                                                        <X className="w-5 h-5 mr-2" /> Cancel
                                                    </button>
                                                )}
                                            </div>
                                            {/* NEW: AI Suggest Concerns Button */}
                                            <div className="mt-5 flex justify-end">
                                                <button
                                                    onClick={handleGenerateConcernSuggestions}
                                                    disabled={generatingConcernSuggestions}
                                                    className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700 transition-colors flex items-center justify-center text-sm disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
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
                                                            <Brain className="w-5 h-5 mr-2" /> AI Suggest Concerns
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                            {/* NEW: Display AI Suggested Concerns */}
                                            {aiSuggestedConcernNames.length > 0 && (
                                                <div className="mt-4 p-4 bg-blue-100 rounded-xl border border-blue-300 shadow-inner">
                                                    <p className="text-base font-semibold text-blue-800 mb-3">AI Suggestions:</p>
                                                    <div className="flex flex-wrap gap-3">
                                                        {aiSuggestedConcernNames.map((suggestion, index) => (
                                                            <button
                                                                key={index}
                                                                onClick={() => setNewConcernName(suggestion)}
                                                                className="px-4 py-2 bg-blue-200 text-blue-800 rounded-full text-sm font-medium hover:bg-blue-300 transition-colors transform hover:scale-105"
                                                            >
                                                                {suggestion}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Concern List */}
                                        <div className="p-6 bg-white rounded-2xl border border-gray-200 shadow-lg">
                                            <div className="flex flex-col sm:flex-row justify-between items-center mb-5 gap-4">
                                                <h4 className="text-xl font-semibold text-gray-800">Existing Concerns ({concerns.length})</h4>
                                                <input
                                                    type="text"
                                                    value={concernFilter}
                                                    onChange={(e) => setConcernFilter(e.target.value)}
                                                    placeholder="Filter concerns..."
                                                    className="px-4 py-2 border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-purple-300 outline-none w-full sm:w-auto"
                                                />
                                            </div>
                                            {selectedConcernIds.length > 0 && (
                                                <button
                                                    onClick={handleDeleteSelectedConcerns}
                                                    className="mb-5 px-5 py-2 bg-red-600 text-white font-semibold rounded-xl shadow-md hover:bg-red-700 transition-colors flex items-center justify-center text-base transform hover:scale-105"
                                                >
                                                    <Trash2 className="w-5 h-5 mr-2" /> Delete Selected ({selectedConcernIds.length})
                                                </button>
                                            )}
                                            <ul className="space-y-3">
                                                {concerns
                                                    .filter(c => c.name.toLowerCase().includes(concernFilter.toLowerCase()))
                                                    .map(concern => (
                                                        <li key={concern.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 shadow-sm transition-all duration-200 hover:shadow-md hover:border-purple-300">
                                                            <div className="flex items-center mb-2 sm:mb-0">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedConcernIds.includes(concern.id)}
                                                                    onChange={() => handleToggleSelectConcern(concern.id)}
                                                                    className="mr-3 h-5 w-5 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
                                                                />
                                                                <span className="font-medium text-lg text-gray-700">{concern.name}</span>
                                                            </div>
                                                            <div className="flex space-x-3 ml-auto sm:ml-0">
                                                                <button onClick={() => handleEditConcern(concern)} className="text-blue-600 hover:text-blue-800 transition-colors transform hover:scale-110">
                                                                    <Edit className="w-6 h-6" />
                                                                </button>
                                                                <button onClick={() => showConfirmation("Are you sure you want to delete this concern?", () => handleDeleteConcern(concern.id))} className="text-red-600 hover:text-red-800 transition-colors transform hover:scale-110">
                                                                    <Trash2 className="w-6 h-6" />
                                                                </button>
                                                            </div>
                                                        </li>
                                                    ))}
                                            </ul>
                                            {concerns.length === 0 && <p className="text-center text-gray-500 py-6 text-lg">No concerns added yet. Use the form above to add your first concern.</p>}
                                        </div>
                                    </div>
                                )}

                                {adminSubTab === 'ingredients' && (
                                    <div className="space-y-8">
                                        <h3 className="text-3xl font-bold text-purple-700 mb-6">Manage Ingredients</h3>
                                        {/* Add Ingredient Form */}
                                        <div className="p-6 bg-purple-50 rounded-2xl border border-purple-100 shadow-lg">
                                            <h4 className="text-xl font-semibold text-purple-800 mb-4">{editingIngredient ? 'Edit Ingredient' : 'Add New Ingredient'}</h4>
                                            <div className="flex flex-col gap-4">
                                                <input
                                                    type="text"
                                                    value={newIngredientName}
                                                    onChange={(e) => setNewIngredientName(e.target.value)}
                                                    placeholder="Ingredient Name"
                                                    className="px-5 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-purple-300 focus:border-purple-500 outline-none transition-all duration-200 text-lg"
                                                />
                                                <textarea
                                                    value={newIngredientDescription}
                                                    onChange={(e) => setNewIngredientDescription(e.target.value)}
                                                    placeholder="Ingredient Description"
                                                    rows="4"
                                                    className="px-5 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-purple-300 focus:border-purple-500 outline-none transition-all duration-200 text-lg"
                                                ></textarea>
                                                <div className="flex gap-4 justify-end">
                                                    <button
                                                        onClick={editingIngredient ? handleUpdateIngredient : () => handleAddIngredient(newIngredientName, newIngredientDescription)}
                                                        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl shadow-md hover:from-purple-700 hover:to-pink-700 transition-all duration-300 transform hover:scale-105 flex items-center justify-center whitespace-nowrap text-base"
                                                    >
                                                        {editingIngredient ? <Save className="w-5 h-5 mr-2" /> : <PlusCircle className="w-5 h-5 mr-2" />}
                                                        {editingIngredient ? 'Update Ingredient' : 'Add Ingredient'}
                                                    </button>
                                                    {editingIngredient && (
                                                        <button
                                                            onClick={() => { setEditingIngredient(null); setNewIngredientName(''); setNewIngredientDescription(''); }}
                                                            className="px-5 py-3 bg-gray-300 text-gray-800 font-semibold rounded-xl shadow-md hover:bg-gray-400 transition-all duration-200 transform hover:scale-105 flex items-center justify-center whitespace-nowrap text-base"
                                                        >
                                                            <X className="w-5 h-5 mr-2" /> Cancel
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Ingredient List */}
                                        <div className="p-6 bg-white rounded-2xl border border-gray-200 shadow-lg">
                                            <div className="flex flex-col sm:flex-row justify-between items-center mb-5 gap-4">
                                                <h4 className="text-xl font-semibold text-gray-800">Existing Ingredients ({ingredients.length})</h4>
                                                <input
                                                    type="text"
                                                    value={ingredientFilter}
                                                    onChange={(e) => setIngredientFilter(e.target.value)}
                                                    placeholder="Filter ingredients..."
                                                    className="px-4 py-2 border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-purple-300 outline-none w-full sm:w-auto"
                                                />
                                            </div>
                                            {selectedIngredientIds.length > 0 && (
                                                <button
                                                    onClick={handleDeleteSelectedIngredients}
                                                    className="mb-5 px-5 py-2 bg-red-600 text-white font-semibold rounded-xl shadow-md hover:bg-red-700 transition-colors flex items-center justify-center text-base transform hover:scale-105"
                                                >
                                                    <Trash2 className="w-5 h-5 mr-2" /> Delete Selected ({selectedIngredientIds.length})
                                                </button>
                                            )}
                                            <ul className="space-y-3">
                                                {ingredients
                                                    .filter(i => i.name.toLowerCase().includes(ingredientFilter.toLowerCase()))
                                                    .map(ingredient => (
                                                        <li key={ingredient.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 shadow-sm transition-all duration-200 hover:shadow-md hover:border-purple-300">
                                                            <div className="flex items-center mb-2 sm:mb-0">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedIngredientIds.includes(ingredient.id)}
                                                                    onChange={() => handleToggleSelectIngredient(ingredient.id)}
                                                                    className="mr-3 h-5 w-5 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
                                                                />
                                                                <div>
                                                                    <span className="font-medium text-lg text-gray-700">{ingredient.name}</span>
                                                                    {ingredient.description && <p className="text-gray-500 text-sm mt-1">{ingredient.description}</p>}
                                                                </div>
                                                            </div>
                                                            <div className="flex space-x-3 ml-auto sm:ml-0">
                                                                <button onClick={() => handleEditIngredient(ingredient)} className="text-blue-600 hover:text-blue-800 transition-colors transform hover:scale-110">
                                                                    <Edit className="w-6 h-6" />
                                                                </button>
                                                                <button onClick={() => handleDeleteIngredient(ingredient.id)} className="text-red-600 hover:text-red-800 transition-colors transform hover:scale-110">
                                                                    <Trash2 className="w-6 h-6" />
                                                                </button>
                                                            </div>
                                                        </li>
                                                    ))}
                                            </ul>
                                            {ingredients.length === 0 && <p className="text-center text-gray-500 py-6 text-lg">No ingredients added yet. Use the form above to add your first ingredient.</p>}
                                        </div>
                                    </div>
                                )}

                                {adminSubTab === 'products' && (
                                    <div className="space-y-8">
                                        <h3 className="text-3xl font-bold text-purple-700 mb-6">Manage Products</h3>
                                        {/* NEW: Shopify Integration Section */}
                                        <div className="p-6 bg-blue-50 rounded-2xl border border-blue-200 shadow-lg">
                                            <h4 className="text-xl font-semibold text-blue-800 mb-4">Fetch Products from Shopify</h4>
                                            <p className="text-base text-gray-700 mb-4">
                                                Enter your Shopify store domain and a **Storefront Access Token** (for client-side fetching) to import products.
                                                <br />
                                                <span className="font-bold text-red-600">Warning:</span> Exposing API keys client-side is NOT secure for production. Use a backend for real integration.
                                            </p>
                                            <div className="flex flex-col sm:flex-row gap-4 mb-4">
                                                <input
                                                    type="text"
                                                    value={shopifyStoreDomain}
                                                    onChange={(e) => setShopifyStoreDomain(e.target.value)}
                                                    placeholder="your-store-name.myshopify.com"
                                                    className="flex-grow px-5 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all duration-200 text-lg"
                                                />
                                                <input
                                                    type="password" // Use type="password" for API keys
                                                    value={shopifyApiKey}
                                                    onChange={(e) => setShopifyApiKey(e.target.value)}
                                                    placeholder="Shopify Storefront Access Token"
                                                    className="flex-grow px-5 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all duration-200 text-lg"
                                                />
                                                <button
                                                    onClick={handleFetchShopifyProducts}
                                                    disabled={fetchingShopifyProducts}
                                                    className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-md hover:bg-blue-700 transition-colors flex items-center justify-center whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed text-base transform hover:scale-105"
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
                                        <div className="p-6 bg-purple-50 rounded-2xl border border-purple-100 shadow-lg">
                                            <h4 className="text-xl font-semibold text-purple-800 mb-4">{editingProduct ? 'Edit Product' : 'Add New Product'}</h4>
                                            <div className="flex flex-col gap-4">
                                                <input
                                                    type="text"
                                                    value={newProductName}
                                                    onChange={(e) => setNewProductName(e.target.value)}
                                                    placeholder="Product Name"
                                                    className="px-5 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-purple-300 focus:border-purple-500 outline-none transition-all duration-200 text-lg"
                                                />
                                                <textarea
                                                    value={newProductDescription}
                                                    onChange={(e) => setNewProductDescription(e.target.value)}
                                                    placeholder="Product Description"
                                                    rows="4"
                                                    className="px-5 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-purple-300 focus:border-purple-500 outline-none transition-all duration-200 text-lg"
                                                ></textarea>
                                                <input
                                                    type="text"
                                                    value={newProductImageUrl}
                                                    onChange={(e) => setNewProductImageUrl(e.target.value)}
                                                    placeholder="Image URL (e.g., https://placehold.co/100x100)"
                                                    className="px-5 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-400 text-lg"
                                                />
                                                <input
                                                    type="text"
                                                    value={newProductShopifyUrl}
                                                    onChange={(e) => setNewProductShopifyUrl(e.target.value)}
                                                    placeholder="Shopify Product URL"
                                                    className="px-5 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-400 text-lg"
                                                />
                                                {/* Ingredient Multi-Select for Products */}
                                                <div className="relative">
                                                    <label className="block text-gray-700 text-base font-bold mb-3">Target Ingredients:</label>
                                                    <div className="flex flex-wrap gap-3 p-3 border border-gray-300 rounded-xl bg-white shadow-sm">
                                                        {ingredients.map(ingredient => (
                                                            <button
                                                                key={ingredient.id}
                                                                onClick={() => handleIngredientSelection(ingredient.name)}
                                                                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 transform hover:scale-105 ${
                                                                    newProductTargetIngredients.includes(ingredient.name)
                                                                        ? 'bg-purple-200 text-purple-800 shadow-sm'
                                                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                                }`}
                                                            >
                                                                {ingredient.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="flex gap-4 justify-end">
                                                    <button
                                                        onClick={editingProduct ? handleUpdateProduct : handleAddProduct}
                                                        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl shadow-md hover:from-purple-700 hover:to-pink-700 transition-all duration-300 transform hover:scale-105 flex items-center justify-center whitespace-nowrap text-base"
                                                    >
                                                        {editingProduct ? <Save className="w-5 h-5 mr-2" /> : <PlusCircle className="w-5 h-5 mr-2" />}
                                                        {editingProduct ? 'Update Product' : 'Add Product'}
                                                    </button>
                                                    {editingProduct && (
                                                        <button
                                                            onClick={() => { setEditingProduct(null); setNewProductName(''); setNewProductDescription(''); setNewProductImageUrl(''); setNewProductShopifyUrl(''); setNewProductTargetIngredients([]); }}
                                                            className="px-5 py-3 bg-gray-300 text-gray-800 font-semibold rounded-xl shadow-md hover:bg-gray-400 transition-all duration-200 transform hover:scale-105 flex items-center justify-center whitespace-nowrap text-base"
                                                        >
                                                            <X className="w-5 h-5 mr-2" /> Cancel
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Product List */}
                                        <div className="p-6 bg-white rounded-2xl border border-gray-200 shadow-lg">
                                            <div className="flex flex-col sm:flex-row justify-between items-center mb-5 gap-4">
                                                <h4 className="text-xl font-semibold text-gray-800">Existing Products ({products.length})</h4>
                                                <input
                                                    type="text"
                                                    value={productFilter}
                                                    onChange={(e) => setProductFilter(e.target.value)}
                                                    placeholder="Filter products..."
                                                    className="px-4 py-2 border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-purple-300 outline-none w-full sm:w-auto"
                                                />
                                            </div>
                                            {selectedProductIds.length > 0 && (
                                                <button
                                                    onClick={handleDeleteSelectedProducts}
                                                    className="mb-5 px-5 py-2 bg-red-600 text-white font-semibold rounded-xl shadow-md hover:bg-red-700 transition-colors flex items-center justify-center text-base transform hover:scale-105"
                                                >
                                                    <Trash2 className="w-5 h-5 mr-2" /> Delete Selected ({selectedProductIds.length})
                                                </button>
                                            )}
                                            <ul className="space-y-3">
                                                {products
                                                    .filter(p => p.name.toLowerCase().includes(productFilter.toLowerCase()))
                                                    .map(product => (
                                                        <li key={product.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 shadow-sm transition-all duration-200 hover:shadow-md hover:border-purple-300">
                                                            <div className="flex items-center mb-2 sm:mb-0">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedProductIds.includes(product.id)}
                                                                    onChange={() => handleToggleSelectProduct(product.id)}
                                                                    className="mr-3 h-5 w-5 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
                                                                />
                                                                <img
                                                                    src={product.imageUrl || `https://placehold.co/60x60/ADD8E6/000000?text=Prod`}
                                                                    alt={product.name}
                                                                    className="w-16 h-16 rounded-lg object-cover mr-4 border border-gray-200 shadow-sm flex-shrink-0"
                                                                    onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/60x60/CCCCCC/000000?text=Error`; }}
                                                                />
                                                                <div>
                                                                    <span className="font-medium text-lg text-gray-700">{product.name}</span>
                                                                    {product.description && <p className="text-gray-500 text-sm mt-1 truncate w-48 sm:w-64">{product.description}</p>}
                                                                    {product.targetIngredients && product.targetIngredients.length > 0 && (
                                                                        <p className="text-gray-600 text-xs mt-1 font-medium">Key: <span className="font-normal">{product.targetIngredients.join(', ')}</span></p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex space-x-3 ml-auto sm:ml-0">
                                                                <button onClick={() => handleEditProduct(product)} className="text-blue-600 hover:text-blue-800 transition-colors transform hover:scale-110">
                                                                    <Edit className="w-6 h-6" />
                                                                </button>
                                                                <button onClick={() => handleDeleteProduct(product.id)} className="text-red-600 hover:text-red-800 transition-colors transform hover:scale-110">
                                                                    <Trash2 className="w-6 h-6" />
                                                                </button>
                                                            </div>
                                                        </li>
                                                    ))}
                                            </ul>
                                            {products.length === 0 && <p className="text-center text-gray-500 py-6 text-lg">No products added yet. Use the form above or fetch from Shopify.</p>}
                                        </div>
                                    </div>
                                )}

                                {adminSubTab === 'mappings' && (
                                    <div className="space-y-8">
                                        <h3 className="text-3xl font-bold text-purple-700 mb-6">Manage Concern-Ingredient Mappings</h3>
                                        {/* Add/Edit Mapping Form */}
                                        <div className="p-6 bg-purple-50 rounded-2xl border border-purple-100 shadow-lg">
                                            <h4 className="text-xl font-semibold text-purple-800 mb-4">{editingMapping ? 'Edit Mapping' : 'Add New Mapping'}</h4>
                                            <div className="flex flex-col gap-4">
                                                <select
                                                    value={selectedConcernForMapping}
                                                    onChange={(e) => {
                                                        setSelectedConcernForMapping(e.target.value);
                                                        setAiSuggestedMappingIngredients([]); // Clear suggestions when concern changes
                                                    }}
                                                    className="px-5 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-purple-300 focus:border-purple-500 outline-none transition-all duration-200 text-lg"
                                                >
                                                    <option value="">Select Concern</option>
                                                    {concerns.map(concern => (
                                                        <option key={concern.id} value={concern.name}>{concern.name}</option>
                                                    ))}
                                                </select>

                                                {/* NEW: AI Suggest Ingredients Button for Mappings */}
                                                <div className="flex justify-end mt-2">
                                                    <button
                                                        onClick={handleGenerateAIIngredientSuggestionsForMapping}
                                                        disabled={!selectedConcernForMapping || generatingMappingIngredientSuggestions}
                                                        className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700 transition-colors flex items-center justify-center text-base disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                                                    >
                                                        {generatingMappingIngredientSuggestions ? (
                                                            <span className="flex items-center">
                                                                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                </svg>
                                                                Generating...
                                                            </span>
                                                        ) : (
                                                            <>
                                                                <Brain className="w-5 h-5 mr-2" /> AI Suggest Ingredients
                                                            </>
                                                        )}
                                                    </button>
                                                </div>

                                                {/* NEW: Display AI Suggested Ingredients for Mappings */}
                                                {aiSuggestedMappingIngredients.length > 0 && (
                                                    <div className="mt-4 p-4 bg-blue-100 rounded-xl border border-blue-300 shadow-inner">
                                                        <p className="text-base font-semibold text-blue-800 mb-3">AI Suggestions:</p>
                                                        <div className="flex flex-wrap gap-3">
                                                            {aiSuggestedMappingIngredients.map((suggestion, index) => (
                                                                <button
                                                                    key={index}
                                                                    onClick={() => handleIngredientToggleForMapping(suggestion)}
                                                                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 transform hover:scale-105 ${
                                                                        selectedIngredientsForMapping.includes(suggestion)
                                                                            ? 'bg-blue-300 text-blue-900 shadow-sm'
                                                                            : 'bg-blue-200 text-blue-800 hover:bg-blue-300'
                                                                    }`}
                                                                >
                                                                    {suggestion}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="relative">
                                                    <label className="block text-gray-700 text-base font-bold mb-3">Select Ingredients:</label>
                                                    <div className="flex flex-wrap gap-3 p-3 border border-gray-300 rounded-xl bg-white shadow-sm">
                                                        {ingredients.map(ingredient => (
                                                            <button
                                                                key={ingredient.id}
                                                                onClick={() => handleIngredientToggleForMapping(ingredient.name)}
                                                                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 transform hover:scale-105 ${
                                                                    selectedIngredientsForMapping.includes(ingredient.name)
                                                                        ? 'bg-pink-200 text-pink-800 shadow-sm'
                                                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                                }`}
                                                            >
                                                                {ingredient.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="flex gap-4 justify-end">
                                                    <button
                                                        onClick={editingMapping ? handleUpdateMapping : handleAddMapping}
                                                        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl shadow-md hover:from-purple-700 hover:to-pink-700 transition-all duration-300 transform hover:scale-105 flex items-center justify-center whitespace-nowrap text-base"
                                                    >
                                                        {editingMapping ? <Save className="w-5 h-5 mr-2" /> : <PlusCircle className="w-5 h-5 mr-2" />}
                                                        {editingMapping ? 'Update Mapping' : 'Add Mapping'}
                                                    </button>
                                                    {editingMapping && (
                                                        <button
                                                            onClick={() => { setEditingMapping(null); setSelectedConcernForMapping(''); setSelectedIngredientsForMapping([]); setAiSuggestedMappingIngredients([]); }}
                                                            className="px-5 py-3 bg-gray-300 text-gray-800 font-semibold rounded-xl shadow-md hover:bg-gray-400 transition-all duration-200 transform hover:scale-105 flex items-center justify-center whitespace-nowrap text-base"
                                                        >
                                                            <X className="w-5 h-5 mr-2" /> Cancel
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Mapping List */}
                                        <div className="p-6 bg-white rounded-2xl border border-gray-200 shadow-lg">
                                            <div className="flex flex-col sm:flex-row justify-between items-center mb-5 gap-4">
                                                <h4 className="text-xl font-semibold text-gray-800">Existing Mappings ({concernIngredientMappings.length})</h4>
                                                <input
                                                    type="text"
                                                    value={mappingFilter}
                                                    onChange={(e) => setMappingFilter(e.target.value)}
                                                    placeholder="Filter mappings..."
                                                    className="px-4 py-2 border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-purple-300 outline-none w-full sm:w-auto"
                                                />
                                            </div>
                                            {selectedMappingIds.length > 0 && (
                                                <button
                                                    onClick={handleDeleteSelectedMappings}
                                                    className="mb-5 px-5 py-2 bg-red-600 text-white font-semibold rounded-xl shadow-md hover:bg-red-700 transition-colors flex items-center justify-center text-base transform hover:scale-105"
                                                >
                                                    <Trash2 className="w-5 h-5 mr-2" /> Delete Selected ({selectedMappingIds.length})
                                                </button>
                                            )}
                                            <ul className="space-y-3">
                                                {concernIngredientMappings
                                                    .filter(m => m.concernName.toLowerCase().includes(mappingFilter.toLowerCase()) ||
                                                        (m.ingredientNames && m.ingredientNames.some(ing => ing.toLowerCase().includes(mappingFilter.toLowerCase()))))
                                                    .map(mapping => (
                                                        <li key={mapping.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 shadow-sm transition-all duration-200 hover:shadow-md hover:border-purple-300">
                                                            <div className="flex items-center mb-2 sm:mb-0">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedMappingIds.includes(mapping.id)}
                                                                    onChange={() => handleToggleSelectMapping(mapping.id)}
                                                                    className="mr-3 h-5 w-5 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
                                                                />
                                                                <div>
                                                                    <span className="font-medium text-lg text-gray-700">{mapping.concernName}</span>
                                                                    {mapping.ingredientNames && mapping.ingredientNames.length > 0 && (
                                                                        <p className="text-gray-500 text-sm mt-1">Ingredients: {mapping.ingredientNames.join(', ')}</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex space-x-3 ml-auto sm:ml-0">
                                                                <button onClick={() => handleEditMapping(mapping)} className="text-blue-600 hover:text-blue-800 transition-colors transform hover:scale-110">
                                                                    <Edit className="w-6 h-6" />
                                                                </button>
                                                                <button onClick={() => handleDeleteMapping(mapping.id)} className="text-red-600 hover:text-red-800 transition-colors transform hover:scale-110">
                                                                    <Trash2 className="w-6 h-6" />
                                                                </button>
                                                            </div>
                                                        </li>
                                                    ))}
                                            </ul>
                                            {concernIngredientMappings.length === 0 && <p className="text-center text-gray-500 py-6 text-lg">No mappings added yet. Select a concern and ingredients above to create one.</p>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Admin Login/Logout Button (for development/testing) */}
            <div className="mt-10 text-center">
                {userRole === 'customer' ? (
                    <button
                        onClick={() => setUserRole('admin')}
                        className="px-8 py-4 bg-gradient-to-r from-gray-200 to-gray-300 text-gray-800 font-bold rounded-2xl shadow-lg hover:from-gray-300 hover:to-gray-400 transition-all duration-300 transform hover:scale-105 text-lg"
                    >
                        Switch to Admin View (Dev Mode)
                    </button>
                ) : (
                    <button
                        onClick={() => { setUserRole('customer'); setActiveTab('customer'); }}
                        className="px-8 py-4 bg-gradient-to-r from-gray-200 to-gray-300 text-gray-800 font-bold rounded-2xl shadow-lg hover:from-gray-300 hover:to-gray-400 transition-all duration-300 transform hover:scale-105 text-lg"
                    >
                        Switch to Customer View
                    </button>
                )}
            </div>

            {/* Confirmation Modal Portal */}
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

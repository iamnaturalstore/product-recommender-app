/* global __initial_auth_token */ // __initial_auth_token is still a Canvas global for specific auth scenarios
import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
// eslint-disable-next-line no-unused-vars
import { getFirestore, collection, query, onSnapshot, doc, setDoc, addDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { CheckCircle, XCircle, Search, Sparkles, Settings, PlusCircle, Edit, Trash2, Save, X, Link, Brain, Filter } from 'lucide-react';

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
    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center">
                <p className="text-lg font-semibold mb-6">{message}</p>
                <div className="flex justify-center gap-4">
                    <button
                        onClick={onConfirm}
                        className="px-5 py-2 bg-red-500 text-white font-semibold rounded-md shadow-md hover:bg-red-600 transition-colors"
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
    const [generatingMapping, setGeneratingMapping] = useState(false);

    const [editingConcern, setEditingConcern] = useState(null);
    const [editingIngredient, setEditingIngredient] = useState(null);
    const [editingProduct, setEditingProduct] = useState(null); // Corrected initialization

    // State for confirmation modal
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmAction, setConfirmAction] = useState(null);
    const [confirmMessage, setConfirmMessage] = useState('');
    const [confirmShowCancel, setConfirmShowCancel] = useState(true); // Changed to useState for proper dependency

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
    }, [publicDataPath]); // Dependencies for useCallback: publicDataPath is a constant, db is outside component


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

    }, [selectedConcerns, ingredients, products, concernIngredientMappings]); // Added concernIngredientMappings to dependencies

    const handleConcernToggle = (concernName) => {
        setSelectedConcerns(prevSelected =>
            prevSelected.includes(concernName)
                ? prevSelected.filter(name => name !== concernName)
                : [...prevSelected, concernName]
        );
    };

    // --- Confirmation Modal Handlers ---
    const showConfirmation = useCallback((message, action, showCancel = true) => {
        setConfirmMessage(message);
        setConfirmAction(() => action); // Use a function to set the action
        setConfirmShowCancel(showCancel);
        setShowConfirmModal(true);
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

    // --- Mappings Functions ---
    const handleAddUpdateMapping = async () => {
        if (!selectedConcernForMapping) {
            showConfirmation("Please select a concern for the mapping.", null, false);
            return;
        }
        if (selectedIngredientsForMapping.length === 0) {
            showConfirmation("Please select at least one ingredient for the mapping.", null, false);
            return;
        }

        const mappingData = {
            concernName: selectedConcernForMapping,
            ingredientNames: selectedIngredientsForMapping,
        };

        try {
            if (editingMapping) {
                await setDoc(doc(db, `${publicDataPath}/concernIngredientMappings`, editingMapping.id), mappingData);
                setEditingMapping(null);
            } else {
                const existingMapping = concernIngredientMappings.find(m => m.concernName === selectedConcernForMapping);
                if (existingMapping) {
                    showConfirmation(`A mapping for "${selectedConcernForMapping}" already exists. Do you want to update it?`, async () => {
                        await setDoc(doc(db, `${publicDataPath}/concernIngredientMappings`, existingMapping.id), mappingData);
                        resetMappingForm();
                    });
                    return;
                }
                await addDoc(collection(db, `${publicDataPath}/concernIngredientMappings`), mappingData);
            }
            resetMappingForm();
        } catch (e) {
            console.error("Error adding/updating mapping: ", e);
            showConfirmation("Failed to add/update mapping. Please try again.", null, false);
        }
    };

    const handleEditMapping = (mapping) => {
        setEditingMapping(mapping);
        setSelectedConcernForMapping(mapping.concernName);
        setSelectedIngredientsForMapping(mapping.ingredientNames || []);
    };

    const handleDeleteMapping = (id) => {
        showConfirmation("Are you sure you want to delete this mapping?", async () => {
            try {
                await deleteDoc(doc(db, `${publicDataPath}/concernIngredientMappings`, id));
            }
            catch (e) {
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

    const handleMappingIngredientToggle = (ingredientName) => {
        setSelectedIngredientsForMapping(prev =>
            prev.includes(ingredientName)
                ? prev.filter(name => name !== ingredientName)
                : [...prev, ingredientName]
        );
    };

    const resetMappingForm = () => {
        setSelectedConcernForMapping('');
        setSelectedIngredientsForMapping([]);
        setEditingMapping(null);
    };

    // --- Gemini API Integration ---
    const handleGenerateMappingWithAI = async () => {
        if (!selectedConcernForMapping) {
            showConfirmation("Please select a beauty concern first to generate ingredients.", null, false);
            return;
        }

        setGeneratingMapping(true);
        setSelectedIngredientsForMapping([]); // Clear previous selections

        try {
            // Modified prompt to request 10-15 ingredients, including highly-reviewed and scientifically-tested ones
            const prompt = `For the beauty concern "${selectedConcernForMapping}", list the top 10-15 most effective and common skincare ingredients, including those highly-rated based on global reviews and the latest modern scientifically-tested ingredients. Respond as a JSON array of strings, like ["Ingredient 1", "Ingredient 2"]. Do not include any other text.`;
            console.log("Gemini API: Sending prompt:", prompt); // Log the prompt
            let chatHistory = [];
            chatHistory.push({ role: "user", parts: [{ text: prompt }] });

            const payload = {
                contents: chatHistory,
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "ARRAY",
                        items: { "type": "STRING" }
                    }
                }
            };
            // Use environment variable for API key
            const apiKey = process.env.REACT_APP_GEMINI_API_KEY || ""; 
            if (!apiKey) {
                console.error("Gemini API Key is missing. Please set REACT_APP_GEMINI_API_KEY in Netlify environment variables.");
                showConfirmation("Gemini API Key is not configured. Please contact support.", null, false);
                setGeneratingMapping(false);
                return;
            }
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            console.log("Gemini API: Raw response result:", result); // Log the raw result

            if (response.ok) { // Check if the response was successful (HTTP status 200-299)
                if (result.candidates && result.candidates.length > 0 &&
                    result.candidates[0].content && result.candidates[0].content.parts &&
                    result.candidates[0].content.parts.length > 0) {
                    const jsonString = result.candidates[0].content.parts[0].text;
                    console.log("Gemini API: Parsed JSON string from response:", jsonString); // Log the JSON string
                    try {
                        const generatedIngredients = JSON.parse(jsonString);
                        console.log("Gemini API: Generated ingredients array:", generatedIngredients); // Log the array
                        if (Array.isArray(generatedIngredients)) {
                            const existingIngredientNames = new Set(ingredients.map(ing => ing.name));
                            console.log("Existing ingredient names:", Array.from(existingIngredientNames)); // Log existing ingredients
                            const newIngredientsToPropose = generatedIngredients.filter(genIng =>
                                !existingIngredientNames.has(genIng)
                            );
                            console.log("New ingredients to propose (not in existing list):", newIngredientsToPropose); // Log new ones

                            if (newIngredientsToPropose.length > 0) {
                                const message = `The AI suggested new ingredients not in your list: ${newIngredientsToPropose.join(', ')}. Do you want to add them?`;
                                showConfirmation(message, async () => {
                                    let newlyAddedIds = [];
                                    for (const newIngName of newIngredientsToPropose) {
                                        const newIngredientObj = await handleAddIngredient(newIngName, 'AI suggested ingredient.');
                                        if (newIngredientObj) {
                                            newlyAddedIds.push(newIngredientObj.id);
                                            // Set the editing ingredient for immediate editing
                                            setEditingIngredient(newIngredientObj);
                                            setNewIngredientName(newIngredientObj.name);
                                            setNewIngredientDescription(newIngredientObj.description);
                                            setAdminSubTab('ingredients'); // Switch to ingredients tab
                                        }
                                    }
                                    setNewlyAddedAIIngredientIds(prev => [...prev, ...newlyAddedIds]);
                                    // After adding, update the selected ingredients for mapping
                                    const allSelected = [...new Set([...selectedIngredientsForMapping, ...generatedIngredients])];
                                    setSelectedIngredientsForMapping(allSelected);
                                });
                            } else {
                                // All generated ingredients already exist or none were new
                                const allSelected = [...new Set([...selectedIngredientsForMapping, ...generatedIngredients])];
                                setSelectedIngredientsForMapping(allSelected);
                                showConfirmation("AI generated ingredients and they are all in your existing list.", null, false);
                            }

                        } else {
                            console.error("Gemini response was not a JSON array:", jsonString);
                            showConfirmation("Failed to parse AI response. Invalid JSON format.", null, false);
                        }
                    } catch (parseError) {
                        console.error("Error parsing AI response JSON:", parseError, jsonString);
                        showConfirmation("Failed to process AI response. Invalid JSON format.", null, false);
                    }
                } else {
                    console.error("Gemini API response structure unexpected or missing content:", result);
                    showConfirmation("AI could not generate recommendations. Please try again. Response was empty or malformed.", null, false);
                }
            } else {
                console.error(`Gemini API request failed with status ${response.status}:`, result);
                showConfirmation(`AI service error: ${response.status}. Please check your API key and billing.`, null, false);
            }
        } catch (error) {
            console.error("Error calling Gemini API:", error);
            showConfirmation("Error connecting to AI service. Please check your network or try again later.", null, false);
        } finally {
            setGeneratingMapping(false);
        }
    };

    // Effect to clear newly added AI ingredient highlights after a delay
    useEffect(() => {
        if (newlyAddedAIIngredientIds.length > 0) {
            const timer = setTimeout(() => {
                setNewlyAddedAIIngredientIds([]);
            }, 5000); // Highlight for 5 seconds
            return () => clearTimeout(timer);
        }
    }, [newlyAddedAIIngredientIds]);


    // Filtered lists for rendering in Admin Panel
    const filteredConcerns = concerns.filter(concern =>
        concern.name.toLowerCase().includes(concernFilter.toLowerCase())
    );

    const filteredIngredients = ingredients.filter(ingredient =>
        ingredient.name.toLowerCase().includes(ingredientFilter.toLowerCase()) ||
        ingredient.description.toLowerCase().includes(ingredientFilter.toLowerCase())
    );

    const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(productFilter.toLowerCase()) ||
        product.description.toLowerCase().includes(productFilter.toLowerCase()) ||
        (product.targetIngredients && product.targetIngredients.some(ing => ing.toLowerCase().includes(productFilter.toLowerCase())))
    );

    const filteredMappings = concernIngredientMappings.filter(mapping =>
        mapping.concernName.toLowerCase().includes(mappingFilter.toLowerCase()) ||
        (mapping.ingredientNames && mapping.ingredientNames.some(ing => ing.toLowerCase().includes(mappingFilter.toLowerCase())))
    );


    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="text-lg font-semibold text-gray-700">Loading your beauty concerns...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-100 p-4 sm:p-6 font-inter text-gray-800">
            {showConfirmModal && (
                <ConfirmationModal
                    message={confirmMessage}
                    onConfirm={handleConfirm}
                    onCancel={handleCancelConfirm}
                    showCancel={confirmShowCancel}
                />
            )}

            <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6 sm:p-8">
                {/* Role Selector */}
                <div className="flex justify-center items-center gap-4 mb-6 p-3 bg-gray-50 rounded-lg shadow-sm">
                    <span className="font-semibold text-gray-700">Select Role:</span>
                    <label className="inline-flex items-center">
                        <input
                            type="radio"
                            className="form-radio text-purple-600 h-5 w-5"
                            name="role"
                            value="customer"
                            checked={userRole === 'customer'}
                            onChange={() => setUserRole('customer')}
                        />
                        <span className="ml-2 text-gray-800">Customer</span>
                    </label>
                    <label className="inline-flex items-center">
                        <input
                            type="radio"
                            className="form-radio text-purple-600 h-5 w-5"
                            name="role"
                            value="admin"
                            checked={userRole === 'admin'}
                            onChange={() => setUserRole('admin')}
                        />
                        <span className="ml-2 text-gray-800">Admin</span>
                    </label>
                </div>

                <div className="flex justify-center mb-6 border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('customer')}
                        className={`px-6 py-3 text-lg font-medium rounded-t-lg transition-colors duration-200
                            ${activeTab === 'customer' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-600 hover:text-purple-700 hover:bg-gray-50'}`}
                    >
                        <Sparkles className="inline-block w-5 h-5 mr-2" /> Customer View
                    </button>
                    {userRole === 'admin' && ( // Conditionally render Admin tab
                        <button
                            onClick={() => setActiveTab('admin')}
                            className={`px-6 py-3 text-lg font-medium rounded-t-lg transition-colors duration-200
                                ${activeTab === 'admin' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-600 hover:text-purple-700 hover:bg-gray-50'}`}
                        >
                            <Settings className="inline-block w-5 h-5 mr-2" /> Admin Panel
                        </button>
                    )}
                </div>

                {userId && (
                    <p className="text-sm text-center text-gray-500 mb-4">
                        Your User ID: <span className="font-mono bg-gray-100 px-2 py-1 rounded-md text-xs">{userId}</span>
                    </p>
                )}

                {activeTab === 'customer' && (
                    <>
                        <h1 className="text-3xl sm:text-4xl font-bold text-center text-purple-700 mb-6 flex items-center justify-center gap-2">
                            <Sparkles className="w-8 h-8 text-pink-500" />
                            Beauty Concern Matcher
                        </h1>

                        <section className="mb-8 p-4 bg-purple-50 rounded-lg shadow-inner">
                            <h2 className="text-xl sm:text-2xl font-semibold text-purple-600 mb-4 flex items-center gap-2">
                                <Search className="w-6 h-6" />
                                Select Your Beauty Concerns
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {concerns.map(concern => (
                                    <button
                                        key={concern.id}
                                        onClick={() => handleConcernToggle(concern.name)}
                                        className={`flex items-center justify-center px-4 py-2 rounded-full border-2 transition-all duration-200 ease-in-out
                                            ${selectedConcerns.includes(concern.name)
                                                ? 'bg-purple-600 text-white border-purple-700 shadow-md'
                                                : 'bg-white text-purple-700 border-purple-300 hover:bg-purple-100 hover:border-purple-500'
                                            }`}
                                    >
                                        {selectedConcerns.includes(concern.name) ? (
                                            <CheckCircle className="w-5 h-5 mr-2" />
                                        ) : (
                                            <XCircle className="w-5 h-5 mr-2 opacity-0 group-hover:opacity-100" />
                                        )}
                                        {concern.name}
                                    </button>
                                ))}
                            </div>
                        </section>

                        {selectedConcerns.length > 0 && (
                            <>
                                <section className="mb-8 p-4 bg-pink-50 rounded-lg shadow-inner">
                                    <h2 className="text-xl sm:text-2xl font-semibold text-pink-600 mb-4 flex items-center gap-2">
                                        <Sparkles className="w-6 h-6" />
                                        Recommended Ingredients
                                    </h2>
                                    {recommendedIngredients.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {recommendedIngredients.map(ing => (
                                                <div key={ing.id} className="bg-white p-4 rounded-lg shadow-sm border border-pink-200">
                                                    <h3 className="font-bold text-lg text-pink-700 mb-1">{ing.name}</h3>
                                                    <p className="text-sm text-gray-600">{ing.description}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-600">No specific ingredients recommended for your selection yet.</p>
                                    )}
                                </section>

                                <section className="p-4 bg-purple-50 rounded-lg shadow-inner">
                                    <h2 className="text-xl sm:text-2xl font-semibold text-purple-600 mb-4 flex items-center gap-2">
                                        <Sparkles className="w-6 h-6" />
                                        Recommended Products
                                    </h2>
                                    {recommendedProducts.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {recommendedProducts.map(product => (
                                                <div key={product.id} className="bg-white p-4 rounded-lg shadow-sm border border-purple-200 flex flex-col items-center text-center">
                                                    <img
                                                        src={product.imageUrl}
                                                        alt={product.name}
                                                        className="w-24 h-24 rounded-lg object-cover mb-3 shadow-md"
                                                        onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/100x100/CCCCCC/000000?text=Product` }} // Fallback image
                                                    />
                                                    <h3 className="font-bold text-lg text-purple-700 mb-1">{product.name}</h3>
                                                    <p className="text-sm text-gray-600 mb-2">{product.description}</p>
                                                    <div className="flex flex-wrap justify-center gap-1 mb-3">
                                                        {product.targetIngredients && product.targetIngredients.map((ing, index) => (
                                                            <span key={index} className="bg-purple-100 text-purple-600 text-xs px-2 py-1 rounded-full">
                                                                {ing}
                                                            </span>
                                                        ))}
                                                    </div>
                                                    {product.shopifyUrl && (
                                                        <a
                                                            href={product.shopifyUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center px-4 py-2 bg-pink-500 text-white font-semibold rounded-full shadow-md hover:bg-pink-600 transition-colors duration-200"
                                                        >
                                                            View Product
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                            </svg>
                                                        </a>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-600">No products found matching your selected concerns. Try selecting different concerns.</p>
                                    )}
                                </section>
                            </>
                        )}
                    </>
                )}

                {userRole === 'admin' && activeTab === 'admin' && ( // Conditionally render Admin content
                    <div className="p-4">
                        <h1 className="text-3xl sm:text-4xl font-bold text-center text-purple-700 mb-6 flex items-center justify-center gap-2">
                            <Settings className="w-8 h-8 text-pink-500" />
                            Admin Panel
                        </h1>

                        <div className="flex justify-center mb-6 border-b border-gray-200">
                            <button
                                onClick={() => setAdminSubTab('concerns')}
                                className={`px-4 py-2 font-medium rounded-t-lg transition-colors duration-200
                                    ${adminSubTab === 'concerns' ? 'bg-pink-500 text-white shadow-md' : 'text-gray-600 hover:text-pink-700 hover:bg-gray-50'}`}
                            >
                                Concerns
                            </button>
                            <button
                                onClick={() => setAdminSubTab('ingredients')}
                                className={`px-4 py-2 font-medium rounded-t-lg transition-colors duration-200
                                    ${adminSubTab === 'ingredients' ? 'bg-pink-500 text-white shadow-md' : 'text-gray-600 hover:text-pink-700 hover:bg-gray-50'}`}
                            >
                                Ingredients
                            </button>
                            <button
                                onClick={() => setAdminSubTab('products')}
                                className={`px-4 py-2 font-medium rounded-t-lg transition-colors duration-200
                                    ${adminSubTab === 'products' ? 'bg-pink-500 text-white shadow-md' : 'text-gray-600 hover:text-pink-700 hover:bg-gray-50'}`}
                            >
                                Products
                            </button>
                            <button
                                onClick={() => setAdminSubTab('mappings')}
                                className={`px-4 py-2 font-medium rounded-t-lg transition-colors duration-200
                                    ${adminSubTab === 'mappings' ? 'bg-pink-500 text-white shadow-md' : 'text-gray-600 hover:text-pink-700 hover:bg-gray-50'}`}
                            >
                                Mappings
                            </button>
                        </div>

                        {adminSubTab === 'concerns' && (
                            <div className="bg-purple-50 p-6 rounded-lg shadow-inner">
                                <h2 className="text-2xl font-semibold text-purple-600 mb-4 flex items-center gap-2">
                                    <PlusCircle className="w-6 h-6" /> Manage Concerns
                                </h2>
                                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                                    <input
                                        type="text"
                                        placeholder="New Concern Name"
                                        value={newConcernName}
                                        onChange={(e) => setNewConcernName(e.target.value)}
                                        className="flex-grow p-3 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400"
                                    />
                                    {editingConcern ? (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleUpdateConcern}
                                                className="px-5 py-3 bg-green-500 text-white font-semibold rounded-md shadow-md hover:bg-green-600 transition-colors duration-200 flex items-center"
                                            >
                                                <Save className="w-5 h-5 mr-2" /> Update
                                            </button>
                                            <button
                                                onClick={() => { setEditingConcern(null); setNewConcernName(''); }}
                                                className="px-5 py-3 bg-gray-400 text-white font-semibold rounded-md shadow-md hover:bg-gray-500 transition-colors duration-200 flex items-center"
                                            >
                                                <X className="w-5 h-5 mr-2" /> Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={handleAddConcern}
                                            className="px-5 py-3 bg-purple-500 text-white font-semibold rounded-md shadow-md hover:bg-purple-600 transition-colors duration-200 flex items-center"
                                        >
                                            <PlusCircle className="w-5 h-5 mr-2" /> Add Concern
                                        </button>
                                    )}
                                </div>

                                <h3 className="text-xl font-semibold text-purple-600 mb-3">Existing Concerns</h3>
                                <div className="relative mb-4">
                                    <input
                                        type="text"
                                        placeholder="Search concerns..."
                                        value={concernFilter}
                                        onChange={(e) => setConcernFilter(e.target.value)}
                                        className="w-full p-3 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400"
                                    />
                                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                </div>
                                <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-purple-200">
                                    {filteredConcerns.length > 0 ? (
                                        <ul className="divide-y divide-gray-200">
                                            {filteredConcerns.map(concern => (
                                                <li key={concern.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                                                    <div className="flex items-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedConcernIds.includes(concern.id)}
                                                            onChange={() => handleToggleSelectConcern(concern.id)}
                                                            className="mr-3 h-5 w-5 text-purple-600 rounded focus:ring-purple-500"
                                                        />
                                                        <span className="text-lg">{concern.name}</span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleEditConcern(concern)}
                                                            className="p-2 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                                                            title="Edit Concern"
                                                        >
                                                            <Edit className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => showConfirmation("Are you sure you want to delete this concern?", () => handleDeleteConcern(concern.id))}
                                                            className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                                                            title="Delete Concern"
                                                        >
                                                            <Trash2 className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="p-4 text-gray-600">No concerns found matching your search.</p>
                                    )}
                                </div>
                                {selectedConcernIds.length > 0 && (
                                    <button
                                        onClick={handleDeleteSelectedConcerns}
                                        className="mt-4 px-5 py-3 bg-red-500 text-white font-semibold rounded-md shadow-md hover:bg-red-600 transition-colors duration-200 flex items-center"
                                    >
                                        <Trash2 className="w-5 h-5 mr-2" /> Delete Selected ({selectedConcernIds.length})
                                    </button>
                                )}
                            </div>
                        )}

                        {adminSubTab === 'ingredients' && (
                            <div className="bg-pink-50 p-6 rounded-lg shadow-inner">
                                <h2 className="text-2xl font-semibold text-pink-600 mb-4 flex items-center gap-2">
                                    <PlusCircle className="w-6 h-6" /> Manage Ingredients
                                </h2>
                                <div className="flex flex-col gap-3 mb-6">
                                    <input
                                        type="text"
                                        placeholder="New Ingredient Name"
                                        value={newIngredientName}
                                        onChange={(e) => setNewIngredientName(e.target.value)}
                                        className="p-3 border border-pink-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-400"
                                    />
                                    <textarea
                                        placeholder="Ingredient Description"
                                        value={newIngredientDescription}
                                        onChange={(e) => setNewIngredientDescription(e.target.value)}
                                        rows="3"
                                        className="p-3 border border-pink-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-400 resize-y"
                                    ></textarea>
                                    {editingIngredient ? (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleUpdateIngredient}
                                                className="px-5 py-3 bg-green-500 text-white font-semibold rounded-md shadow-md hover:bg-green-600 transition-colors duration-200 flex items-center"
                                            >
                                                <Save className="w-5 h-5 mr-2" /> Update
                                            </button>
                                            <button
                                                onClick={() => { setEditingIngredient(null); setNewIngredientName(''); setNewIngredientDescription(''); }}
                                                className="px-5 py-3 bg-gray-400 text-white font-semibold rounded-md shadow-md hover:bg-gray-500 transition-colors duration-200 flex items-center"
                                            >
                                                <X className="w-5 h-5 mr-2" /> Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleAddIngredient(newIngredientName, newIngredientDescription)}
                                            className="px-5 py-3 bg-pink-500 text-white font-semibold rounded-md shadow-md hover:bg-pink-600 transition-colors duration-200 flex items-center"
                                        >
                                            <PlusCircle className="w-5 h-5 mr-2" /> Add Ingredient
                                        </button>
                                    )}
                                </div>

                                <h3 className="text-xl font-semibold text-pink-600 mb-3">Existing Ingredients</h3>
                                <div className="relative mb-4">
                                    <input
                                        type="text"
                                        placeholder="Search ingredients..."
                                        value={ingredientFilter}
                                        onChange={(e) => setIngredientFilter(e.target.value)}
                                        className="w-full p-3 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-400"
                                    />
                                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                </div>
                                <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-pink-200">
                                    {filteredIngredients.length > 0 ? (
                                        <ul className="divide-y divide-gray-200">
                                            {filteredIngredients.map(ingredient => (
                                                <li
                                                    key={ingredient.id}
                                                    className={`p-4 hover:bg-gray-50 transition-colors relative
                                                        ${newlyAddedAIIngredientIds.includes(ingredient.id) ? 'bg-yellow-50 border-yellow-300' : ''}`}
                                                >
                                                    {newlyAddedAIIngredientIds.includes(ingredient.id) && (
                                                        <span className="absolute top-2 right-2 bg-yellow-200 text-yellow-800 text-xs px-2 py-1 rounded-full font-semibold">
                                                            New!
                                                        </span>
                                                    )}
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex items-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedIngredientIds.includes(ingredient.id)}
                                                                onChange={() => handleToggleSelectIngredient(ingredient.id)}
                                                                className="mr-3 h-5 w-5 text-pink-600 rounded focus:ring-pink-500"
                                                            />
                                                            <span className="text-lg font-medium">{ingredient.name}</span>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleEditIngredient(ingredient)}
                                                                className="p-2 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                                                                title="Edit Ingredient"
                                                            >
                                                                <Edit className="w-5 h-5" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteIngredient(ingredient.id)}
                                                                className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                                                                title="Delete Ingredient"
                                                            >
                                                                <Trash2 className="w-5 h-5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <p className="text-sm text-gray-600">{ingredient.description}</p>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="p-4 text-gray-600">No ingredients found matching your search.</p>
                                    )}
                                </div>
                                {selectedIngredientIds.length > 0 && (
                                    <button
                                        onClick={handleDeleteSelectedIngredients}
                                        className="mt-4 px-5 py-3 bg-red-500 text-white font-semibold rounded-md shadow-md hover:bg-red-600 transition-colors duration-200 flex items-center"
                                    >
                                        <Trash2 className="w-5 h-5 mr-2" /> Delete Selected ({selectedIngredientIds.length})
                                    </button>
                                )}
                            </div>
                        )}

                        {adminSubTab === 'products' && (
                            <div className="bg-purple-50 p-6 rounded-lg shadow-inner">
                                <h2 className="text-2xl font-semibold text-purple-600 mb-4 flex items-center gap-2">
                                    <PlusCircle className="w-6 h-6" /> Manage Products
                                </h2>
                                <div className="flex flex-col gap-3 mb-6">
                                    <input
                                        type="text"
                                        placeholder="Product Name"
                                        value={newProductName}
                                        onChange={(e) => setNewProductName(e.target.value)}
                                        className="p-3 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400"
                                    />
                                    <textarea
                                        placeholder="Product Description"
                                        value={newProductDescription}
                                        onChange={(e) => setNewProductDescription(e.target.value)}
                                        rows="3"
                                        className="p-3 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400 resize-y"
                                    ></textarea>
                                    <input
                                        type="text"
                                        placeholder="Image URL (e.g., https://placehold.co/100x100)"
                                        value={newProductImageUrl}
                                        onChange={(e) => setNewProductImageUrl(e.target.value)}
                                        className="p-3 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Shopify Product URL"
                                        value={newProductShopifyUrl}
                                        onChange={(e) => setNewProductShopifyUrl(e.target.value)}
                                        className="p-3 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400"
                                    />

                                    <h4 className="font-semibold text-purple-600 mt-2 mb-2">Target Ingredients:</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {ingredients.map(ing => (
                                            <button
                                                key={ing.id}
                                                onClick={() => handleIngredientSelection(ing.name)}
                                                className={`px-3 py-1 rounded-full border transition-all duration-200
                                                    ${newProductTargetIngredients.includes(ing.name)
                                                        ? 'bg-purple-600 text-white border-purple-700'
                                                        : 'bg-white text-purple-700 border-purple-300 hover:bg-purple-100'
                                                    }`}
                                            >
                                                {ing.name}
                                            </button>
                                        ))}
                                    </div>

                                    {editingProduct ? (
                                        <div className="flex gap-2 mt-4">
                                            <button
                                                onClick={handleUpdateProduct}
                                                className="px-5 py-3 bg-green-500 text-white font-semibold rounded-md shadow-md hover:bg-green-600 transition-colors duration-200 flex items-center"
                                            >
                                                <Save className="w-5 h-5 mr-2" /> Update
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setEditingProduct(null);
                                                    setNewProductName('');
                                                    setNewProductDescription('');
                                                    setNewProductImageUrl('');
                                                    setNewProductShopifyUrl('');
                                                    setNewProductTargetIngredients([]);
                                                }}
                                                className="px-5 py-3 bg-gray-400 text-white font-semibold rounded-md shadow-md hover:bg-gray-500 transition-colors duration-200 flex items-center"
                                            >
                                                <X className="w-5 h-5 mr-2" /> Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={handleAddProduct}
                                                className="px-5 py-3 bg-purple-500 text-white font-semibold rounded-md shadow-md hover:bg-purple-600 transition-colors duration-200 flex items-center mt-4"
                                            >
                                                <PlusCircle className="w-5 h-5 mr-2" /> Add Product
                                            </button>
                                        )}
                                    </div>

                                    <h3 className="text-xl font-semibold text-purple-600 mb-3">Existing Products</h3>
                                    <div className="relative mb-4">
                                        <input
                                            type="text"
                                            placeholder="Search products..."
                                            value={productFilter}
                                            onChange={(e) => setProductFilter(e.target.value)}
                                            className="w-full p-3 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400"
                                        />
                                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    </div>
                                    <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-purple-200">
                                        {filteredProducts.length > 0 ? (
                                            <ul className="divide-y divide-gray-200">
                                                {filteredProducts.map(product => (
                                                    <li key={product.id} className="p-4 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row items-center sm:items-start gap-4">
                                                        <div className="flex items-center flex-shrink-0">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedProductIds.includes(product.id)}
                                                                onChange={() => handleToggleSelectProduct(product.id)}
                                                                className="mr-3 h-5 w-5 text-purple-600 rounded focus:ring-purple-500"
                                                            />
                                                            <img
                                                                src={product.imageUrl}
                                                                alt={product.name}
                                                                className="w-20 h-20 rounded-md object-cover"
                                                                onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/80x80/CCCCCC/000000?text=Prod` }}
                                                            />
                                                        </div>
                                                        <div className="flex-grow text-center sm:text-left">
                                                            <span className="text-lg font-medium text-purple-800">{product.name}</span>
                                                            <p className="text-sm text-gray-600 mb-1">{product.description}</p>
                                                            <div className="flex flex-wrap justify-center sm:justify-start gap-1">
                                                                {product.targetIngredients && product.targetIngredients.map((ing, index) => (
                                                                    <span key={index} className="bg-purple-100 text-purple-600 text-xs px-2 py-1 rounded-full">
                                                                        {ing}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2 flex-shrink-0 mt-3 sm:mt-0">
                                                            <button
                                                                onClick={() => handleEditProduct(product)}
                                                                className="p-2 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                                                                title="Edit Product"
                                                            >
                                                                <Edit className="w-5 h-5" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteProduct(product.id)}
                                                                className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                                                                title="Delete Product"
                                                            >
                                                                <Trash2 className="w-5 h-5" />
                                                            </button>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="p-4 text-gray-600">No products found matching your search.</p>
                                        )}
                                    </div>
                                    {selectedProductIds.length > 0 && (
                                        <button
                                            onClick={handleDeleteSelectedProducts}
                                            className="mt-4 px-5 py-3 bg-red-500 text-white font-semibold rounded-md shadow-md hover:bg-red-600 transition-colors duration-200 flex items-center"
                                        >
                                            <Trash2 className="w-5 h-5 mr-2" /> Delete Selected ({selectedProductIds.length})
                                        </button>
                                    )}
                                </div>
                            )}

                            {adminSubTab === 'mappings' && (
                                <div className="bg-pink-50 p-6 rounded-lg shadow-inner">
                                    <h2 className="text-2xl font-semibold text-pink-600 mb-4 flex items-center gap-2">
                                        <Link className="w-6 h-6" /> Manage Concern-Ingredient Mappings
                                    </h2>
                                    <div className="flex flex-col gap-3 mb-6">
                                        <label htmlFor="concern-select" className="font-semibold text-pink-700">Select Concern:</label>
                                        <select
                                            id="concern-select"
                                            value={selectedConcernForMapping}
                                            onChange={(e) => {
                                                setSelectedConcernForMapping(e.target.value);
                                                const existing = concernIngredientMappings.find(m => m.concernName === e.target.value);
                                                setSelectedIngredientsForMapping(existing ? (existing.ingredientNames || []) : []);
                                            }}
                                            className="p-3 border border-pink-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-400"
                                        >
                                            <option value="">-- Select a Concern --</option>
                                            {concerns.map(concern => (
                                                <option key={concern.id} value={concern.name}>{concern.name}</option>
                                            ))}
                                        </select>

                                        <button
                                            onClick={handleGenerateMappingWithAI}
                                            disabled={!selectedConcernForMapping || generatingMapping}
                                            className={`px-5 py-3 rounded-md shadow-md transition-colors duration-200 flex items-center justify-center
                                                ${!selectedConcernForMapping || generatingMapping
                                                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                                    : 'bg-purple-500 text-white hover:bg-purple-600'
                                                }`}
                                        >
                                            {generatingMapping ? (
                                                <span className="flex items-center">
                                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Generating...
                                                </span>
                                            ) : (
                                                <>
                                                    <Brain className="w-5 h-5 mr-2" /> Generate Ingredients with AI
                                                </>
                                            )}
                                        </button>

                                        <h4 className="font-semibold text-pink-700 mt-2">Selected Ingredients for this Concern:</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {ingredients.map(ing => (
                                                <button
                                                    key={ing.id}
                                                    onClick={() => handleMappingIngredientToggle(ing.name)}
                                                    className={`px-3 py-1 rounded-full border transition-all duration-200
                                                        ${selectedIngredientsForMapping.includes(ing.name)
                                                            ? 'bg-pink-600 text-white border-pink-700'
                                                            : 'bg-white text-pink-700 border-pink-300 hover:bg-pink-100'
                                                        }`}
                                                >
                                                    {ing.name}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="flex gap-2 mt-4">
                                            <button
                                                onClick={handleAddUpdateMapping}
                                                disabled={!selectedConcernForMapping || selectedIngredientsForMapping.length === 0}
                                                className={`px-5 py-3 rounded-md shadow-md transition-colors duration-200 flex items-center
                                                    ${!selectedConcernForMapping || selectedIngredientsForMapping.length === 0
                                                        ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                                        : 'bg-pink-500 text-white hover:bg-pink-600'
                                                    }`}
                                            >
                                                {editingMapping ? <Save className="w-5 h-5 mr-2" /> : <PlusCircle className="w-5 h-5 mr-2" />}
                                                {editingMapping ? 'Update Mapping' : 'Add Mapping'}
                                            </button>
                                            {editingMapping && (
                                                <button
                                                    onClick={resetMappingForm}
                                                    className="px-5 py-3 bg-gray-400 text-white font-semibold rounded-md shadow-md hover:bg-gray-500 transition-colors duration-200 flex items-center"
                                                >
                                                    <X className="w-5 h-5 mr-2" /> Cancel
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <h3 className="text-xl font-semibold text-pink-600 mb-3">Existing Mappings</h3>
                                    <div className="relative mb-4">
                                        <input
                                            type="text"
                                            placeholder="Search mappings..."
                                            value={mappingFilter}
                                            onChange={(e) => setMappingFilter(e.target.value)}
                                            className="w-full p-3 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-400"
                                        />
                                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    </div>
                                    <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-pink-200">
                                        {filteredMappings.length > 0 ? (
                                            <ul className="divide-y divide-gray-200">
                                                {filteredMappings.map(mapping => (
                                                    <li key={mapping.id} className="p-4 hover:bg-gray-50 transition-colors">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <div className="flex items-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedMappingIds.includes(mapping.id)}
                                                                    onChange={() => handleToggleSelectMapping(mapping.id)}
                                                                    className="mr-3 h-5 w-5 text-pink-600 rounded focus:ring-pink-500"
                                                                />
                                                                <span className="text-lg font-medium text-pink-800">{mapping.concernName}</span>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => handleEditMapping(mapping)}
                                                                    className="p-2 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                                                                    title="Edit Mapping"
                                                                >
                                                                    <Edit className="w-5 h-5" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteMapping(mapping.id)}
                                                                    className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                                                                    title="Delete Mapping"
                                                                >
                                                                    <Trash2 className="w-5 h-5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <p className="text-sm text-gray-600">
                                                            Ingredients: {mapping.ingredientNames && mapping.ingredientNames.length > 0
                                                                ? mapping.ingredientNames.join(', ')
                                                                : 'None'}
                                                        </p>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="p-4 text-gray-600">No mappings found matching your search.</p>
                                        )}
                                    </div>
                                    {selectedMappingIds.length > 0 && (
                                        <button
                                            onClick={handleDeleteSelectedMappings}
                                            className="mt-4 px-5 py-3 bg-red-500 text-white font-semibold rounded-md shadow-md hover:bg-red-600 transition-colors duration-200 flex items-center"
                                        >
                                            <Trash2 className="w-5 h-5 mr-2" /> Delete Selected ({selectedMappingIds.length})
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    export default App;

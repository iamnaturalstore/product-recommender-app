import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, doc, setDoc, addDoc, deleteDoc, getDocs } from 'firebase/firestore';

import { CheckCircle, XCircle, Search, Sparkles, Settings, PlusCircle, Edit, Trash2, Save, X, Link, Brain, Filter, Download, Lightbulb } from 'lucide-react'; // Added Lightbulb icon

// Assuming ConfirmationModal is a separate component you have defined in './ConfirmationModal.js'.
import ConfirmationModal from './ConfirmationModal';

// Firebase Initialization and Globals
// These variables are provided by the Canvas environment.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
let firebaseConfig = {};
try {
    firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
} catch (e) {
    console.error("Error parsing __firebase_config:", e);
}

let app, db, auth;
if (Object.keys(firebaseConfig).length > 0 && firebaseConfig.projectId) {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        console.log("Firebase initialized successfully.");
    } catch (error) {
        console.error("Firebase initialization error:", error);
    }
} else {
    console.error("Firebase configuration is missing or incomplete. Cannot initialize Firebase.");
}


function App() {
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

    // State for highlighting newly added AI ingredients (customer side)
    const [newlyAddedAIIngredientIds, setNewlyAddedAIIngredientIds] = useState([]);

    // States for bulk selection
    const [selectedConcernIds, setSelectedConcernIds] = useState([]);
    const [selectedIngredientIds, setSelectedIngredientIds] = useState([]);
    const [selectedProductIds, setSelectedProductIds] = useState([]);
    const [selectedMappingIds, setSelectedMappingIds] = useState([]);

    // New state for simulated user role
    const [userRole, setUserRole] = useState('customer');

    // New state for custom concern input and current recommendations source
    const [customConcernInput, setCustomConcernInput] = useState('');
    const [currentCustomerConcern, setCurrentCustomerConcern] = useState('');

    // NEW STATES for Shopify Integration
    const [shopifyStoreDomain, setShopifyStoreDomain] = useState('');
    const [shopifyApiKey, setShopifyApiKey] = useState('');
    const [fetchingShopifyProducts, setFetchingShopifyProducts] = useState(false);

    // NEW STATE for AI generated ingredients on Admin side
    const [aiSuggestedIngredientsForAdmin, setAiSuggestedIngredientsForAdmin] = useState([]);
    const [generatingAIIngredients, setGeneratingAIIngredients] = useState(false);


    const publicDataPath = `artifacts/${appId}/public/data`;

    // Function to add sample data (for demonstration purposes)
    const addSampleData = useCallback(async () => {
        if (!db) {
            console.error("addSampleData: Firestore db is not initialized. Cannot add sample data.");
            return;
        }
        console.log("addSampleData: Attempting to add sample data to path:", publicDataPath);

        const sampleConcerns = [
            { id: 'concern_acne', name: 'Acne' },
            { id: 'concern_dryness', name: 'Dryness' },
            { id: 'concern_finelines', name: 'Fine Lines & Wrinkles' },
            { id: 'concern_redness', name: 'Redness' },
            { id: 'concern_hyperpigmentation', name: 'Hyperpigmentation' },
            { id: 'concern_dullness', name: 'Dullness' },
        ];
        const sampleIngredients = [
            { id: 'ing_salicylic', name: 'Salicylic Acid', description: 'Exfoliates inside pores, good for acne.' },
            { id: 'ing_hyaluronic', name: 'Hyaluronic Acid', description: 'Attracts and holds moisture, great for dryness.' },
            { id: 'ing_retinol', name: 'Retinol', description: 'Boosts cell turnover, reduces fine lines.' },
            { id: 'ing_niacinamide', name: 'Niacinamide', description: 'Reduces redness and improves skin barrier.' },
            { id: 'ing_vitaminc', name: 'Vitamin C', description: 'Brightens skin and reduces hyperpigmentation.' },
            { id: 'ing_aha', name: 'Alpha Hydroxy Acids (AHAs)', description: 'Exfoliates dead skin cells, improves texture.' },
        ];
        const sampleProducts = [
            { id: 'prod_acne_cleanser', name: 'Acne Clearing Cleanser', description: 'A gentle cleanser with salicylic acid to combat breakouts.', imageUrl: 'https://placehold.co/100x100/ADD8E6/000000?text=Acne+Cleanser', targetIngredients: ['Salicylic Acid'], shopifyUrl: 'https://example.com/shopify/acne-cleanser' },
            { id: 'prod_hydrating_serum', name: 'Deep Hydration Serum', description: 'Infused with hyaluronic acid for intense moisture.', imageUrl: 'https://placehold.co/100x100/B0E0E6/000000?text=Hydrating+Serum', targetIngredients: ['Hyaluronic Acid', 'Niacinamide'], shopifyUrl: 'https://example.com/shopify/hydrating-serum' },
            { id: 'prod_antiaging_cream', name: 'Youthful Glow Cream', description: 'Retinol-powered cream to smooth fine lines and wrinkles.', imageUrl: 'https://placehold.co/100x100/87CEEB/000000?text=Anti-Aging+Cream', targetIngredients: ['Retinol', 'Hyaluronic Acid'], shopifyUrl: 'https://example.com/shopify/anti-aging-cream' },
            { id: 'prod_brightening_mask', name: 'Radiance Boosting Mask', description: 'Vitamin C mask for a brighter, more even complexion.', imageUrl: 'https://placehold.co/100x100/6495ED/000000?text=Brightening+Mask', targetIngredients: ['Vitamin C', 'Alpha Hydroxy Acids (AHAs)'], shopifyUrl: 'https://example.com/shopify/brightening-mask' },
            { id: 'prod_calming_lotion', name: 'Redness Relief Lotion', description: 'Soothes irritated skin with niacinamide.', imageUrl: 'https://placehold.co/100x100/4682B4/000000?text=Calming+Lotion', targetIngredients: ['Niacinamide'], shopifyUrl: 'https://example.com/shopify/calming-lotion' },
        ];
        const sampleMappings = [
            { id: 'map_acne', concernName: 'Acne', ingredientNames: ['Salicylic Acid', 'Niacinamide'] },
            { id: 'map_dryness', concernName: 'Dryness', ingredientNames: ['Hyaluronic Acid', 'Niacinamide'] },
            { id: 'map_finelines', concernName: 'Fine Lines & Wrinkles', ingredientNames: ['Retinol', 'Hyaluronic Acid'] },
            { id: 'map_redness', concernName: 'Redness', ingredientNames: ['Niacinamide'] },
            { id: 'map_hyperpigmentation', concernName: 'Hyperpigmentation', ingredientNames: ['Vitamin C', 'Alpha Hydroxy Acids (AHAs)'] },
            { id: 'map_dullness', concernName: 'Dullness', ingredientNames: ['Vitamin C', 'Alpha Hydroxy Acids (AHAs)', 'Niacinamide'] },
        ];

        const collectionsToAdd = [
            { name: 'concerns', data: sampleConcerns },
            { name: 'ingredients', data: sampleIngredients },
            { name: 'products', data: sampleProducts },
            { name: 'concerningredientMappings', data: sampleMappings },
        ];

        for (const col of collectionsToAdd) {
            const colRef = collection(db, `${publicDataPath}/${col.name}`);
            const snapshot = await getDocs(colRef);
            if (snapshot.empty) {
                console.log(`addSampleData: Adding sample ${col.name}...`);
                for (const item of col.data) {
                    await setDoc(doc(colRef, item.id), item);
                }
                console.log(`addSampleData: Finished adding sample ${col.name}.`);
            } else {
                console.log(`addSampleData: ${col.name} collection is not empty. Skipping sample data addition.`);
            }
        }
        console.log("addSampleData: Sample data check/addition complete.");
    }, [publicDataPath]);

    useEffect(() => {
        console.log("Auth useEffect: Triggered. app:", !!app, "db:", !!db, "auth:", !!auth);
        if (!app || !db || !auth) {
            console.error("Auth useEffect: Firebase not fully initialized. Skipping auth setup.");
            setLoading(false);
            return;
        }

        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                console.log("Auth useEffect: Signed in with user ID:", user.uid);
            } else {
                try {
                    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                        await signInWithCustomToken(auth, __initial_auth_token);
                        console.log("Auth useEffect: Signed in with custom token.");
                    } else {
                        await signInAnonymously(auth);
                        console.log("Auth useEffect: Signed in anonymously.");
                    }
                } catch (error) {
                    console.error("Auth useEffect: Firebase authentication error:", error);
                }
            }
            setIsAuthReady(true);
            console.log("Auth useEffect: setIsAuthReady(true)");
        });

        return () => {
            console.log("Auth useEffect: Cleaning up auth listener.");
            unsubscribeAuth();
        };
    }, []);

    useEffect(() => {
        console.log("Data Fetch useEffect: Triggered. isAuthReady:", isAuthReady, "db:", !!db);

        if (!isAuthReady || !db) {
            console.log("Data Fetch useEffect: Skipping data fetch: Auth not ready or db not initialized.");
            return;
        }

        console.log("Data Fetch useEffect: Calling addSampleData...");
        addSampleData();

        const setupListeners = () => {
            console.log("Data Fetch useEffect: Setting up Firestore listeners.");

            const unsubscribeConcerns = onSnapshot(collection(db, `${publicDataPath}/concerns`), (snapshot) => {
                const fetchedConcerns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log("onSnapshot (Concerns): Fetched:", fetchedConcerns);
                setConcerns(fetchedConcerns);
                setLoading(false);
            }, (error) => {
                console.error("onSnapshot Error (Concerns):", error);
                setLoading(false);
            });

            const unsubscribeIngredients = onSnapshot(collection(db, `${publicDataPath}/ingredients`), (snapshot) => {
                const fetchedIngredients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log("onSnapshot (Ingredients): Fetched:", fetchedIngredients);
                setIngredients(fetchedIngredients);
            }, (error) => {
                console.error("onSnapshot Error (Ingredients):", error);
            });

            const unsubscribeProducts = onSnapshot(collection(db, `${publicDataPath}/products`), (snapshot) => {
                const fetchedProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log("onSnapshot (Products): Fetched:", fetchedProducts);
                setProducts(fetchedProducts);
            }, (error) => {
                console.error("onSnapshot Error (Products):", error);
            });

            const unsubscribeMappings = onSnapshot(collection(db, `${publicDataPath}/concerningredientMappings`), (snapshot) => {
                const fetchedMappings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log("onSnapshot (Mappings): Fetched:", fetchedMappings);
                setConcernIngredientMappings(fetchedMappings);
            }, (error) => {
                console.error("onSnapshot Error (Mappings):", error);
            });

            return () => {
                console.log("Data Fetch useEffect: Cleaning up Firestore listeners.");
                unsubscribeConcerns();
                unsubscribeIngredients();
                unsubscribeProducts();
                unsubscribeMappings();
            };
        };

        return setupListeners();

    }, [isAuthReady, addSampleData, publicDataPath]);

    useEffect(() => {
        if (currentCustomerConcern) {
            return;
        }

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
    }, [selectedConcerns, ingredients, products, concernIngredientMappings, currentCustomerConcern]);

    const handleConcernToggle = (concernName) => {
        setSelectedConcerns(prevSelected =>
            prevSelected.includes(concernName)
                ? prevSelected.filter(name => name !== concernName)
                : [...prevSelected, concernName]
        );
        setCustomConcernInput('');
        setCurrentCustomerConcern('');
    };

    const showConfirmation = useCallback((message, action, showCancel = true) => {
        setConfirmMessage(message);
        setConfirmAction(() => action);
        setConfirmShowCancel(showCancel);
        setShowConfirmModal(true);
    }, []);

    const handleConfirm = useCallback(() => {
        if (confirmAction) {
            confirmAction();
        }
        setShowConfirmModal(false);
        setConfirmAction(null);
        setConfirmMessage('');
        setConfirmShowCancel(true);
    }, [confirmAction, setShowConfirmModal, setConfirmAction, setConfirmMessage, setConfirmShowCancel]);

    const handleCancelConfirm = useCallback(() => {
        setShowConfirmModal(false);
        setConfirmAction(null);
        setConfirmMessage('');
        setConfirmShowCancel(true);
    }, [setShowConfirmModal, setConfirmAction, setConfirmMessage, setConfirmShowCancel]);

    const handleGenerateRecommendationsForCustomer = async (concernText) => {
        if (!concernText.trim() && selectedConcerns.length === 0) {
            showConfirmation("Please select a concern or enter your own.", null, false);
            return;
        }
        setLoading(true);
        setNewlyAddedAIIngredientIds([]);
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
        setCurrentCustomerConcern(currentSource);

        try {
            const apiKey = "";
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = { contents: chatHistory };

            console.log("Gemini Call (Customer): Sending prompt:", prompt);

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            console.log("Gemini Call (Customer): Raw Response:", result);

            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const text = result.candidates[0].content.parts[0].text;
                console.log("Gemini Call (Customer): Response Text:", text);

                const parsedIngredients = [];
                const items = text.split(',').map(item => item.trim());
                items.forEach(item => {
                    const firstColonIndex = item.indexOf(':');
                    if (firstColonIndex !== -1) {
                        const name = item.substring(0, firstColonIndex).trim();
                        const description = item.substring(firstColonIndex + 1).trim();
                        if (name) {
                            parsedIngredients.push({ name, description });
                        }
                    } else if (item) {
                        parsedIngredients.push({ name: item, description: '' });
                    }
                });
                console.log("Gemini Call (Customer): Parsed Ingredients:", parsedIngredients);

                const newIngredientPromises = [];
                const newlyAddedIds = [];
                const existingIngredientNamesLower = new Set(ingredients.map(ing => ing.name.toLowerCase()));

                for (const aiIng of parsedIngredients) {
                    if (!existingIngredientNamesLower.has(aiIng.name.toLowerCase())) {
                        newIngredientPromises.push(
                            handleAddIngredient(aiIng.name, aiIng.description)
                                .then(newDoc => {
                                    if (newDoc) {
                                        newlyAddedIds.push(newDoc.id);
                                        console.log("AI Ingredient (Customer): Added to Firestore:", newDoc);
                                    }
                                    return newDoc;
                                })
                        );
                    }
                }
                await Promise.all(newIngredientPromises);
                setNewlyAddedAIIngredientIds(newlyAddedIds);

                const allCurrentAndAIIngredientNames = new Set(ingredients.map(ing => ing.name.toLowerCase()));
                parsedIngredients.forEach(aiIng => allCurrentAndAIIngredientNames.add(aiIng.name.toLowerCase()));

                console.log("Recommendation Logic (Customer): All Current and AI Ingredient Names for Filtering:", Array.from(allCurrentAndAIIngredientNames));

                const filteredProducts = products.filter(product =>
                    product.targetIngredients && product.targetIngredients.some(prodIng =>
                        allCurrentAndAIIngredientNames.has(prodIng.toLowerCase())
                    )
                );
                console.log("Recommendation Logic (Customer): Filtered Products:", filteredProducts);

                setRecommendedIngredients(parsedIngredients.filter(ing => allCurrentAndAIIngredientNames.has(ing.name.toLowerCase())));
                setRecommendedProducts(filteredProducts);

                if (parsedIngredients.length === 0 && filteredProducts.length === 0) {
                    showConfirmation("No recommendations found. Please try a different concern.", null, false);
                }

            } else {
                showConfirmation("No recommendations found. Please try a different concern.", null, false);
            }
        } catch (error) {
            console.error("Error generating recommendations (Customer):", error);
            showConfirmation("Failed to get recommendations. Please try again.", null, false);
        } finally {
            setLoading(false);
        }
    };

    // NEW: Handle AI Ingredient Suggestions for Admin Concerns
    const handleGenerateIngredientsForConcern = async (concernName) => {
        if (!concernName.trim()) {
            showConfirmation("Please enter a concern name to get ingredient suggestions.", null, false);
            return;
        }
        setGeneratingAIIngredients(true);
        setAiSuggestedIngredientsForAdmin([]); // Clear previous suggestions

        const prompt = `Given the beauty concern: "${concernName.trim()}", what are the top 3-5 key skincare ingredients that would effectively address this? Provide only the ingredient names, separated by commas. Also, briefly describe what each ingredient does in a sentence or two. For example: "Ingredient1: Description1, Ingredient2: Description2".`;

        try {
            const apiKey = ""; // Canvas will inject it for Gemini API calls
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = { contents: chatHistory };

            console.log("Gemini Call (Admin): Sending prompt:", prompt);

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            console.log("Gemini Call (Admin): Raw Response:", result);

            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const text = result.candidates[0].content.parts[0].text;
                console.log("Gemini Call (Admin): Response Text:", text);

                const parsedIngredients = [];
                const items = text.split(',').map(item => item.trim());
                items.forEach(item => {
                    const firstColonIndex = item.indexOf(':');
                    if (firstColonIndex !== -1) {
                        const name = item.substring(0, firstColonIndex).trim();
                        const description = item.substring(firstColonIndex + 1).trim();
                        if (name) {
                            parsedIngredients.push({ name, description });
                        }
                    } else if (item) {
                        parsedIngredients.push({ name: item, description: '' });
                    }
                });
                setAiSuggestedIngredientsForAdmin(parsedIngredients);
                if (parsedIngredients.length === 0) {
                    showConfirmation("AI could not suggest ingredients for this concern. Please try a different phrasing.", null, false);
                }
            } else {
                showConfirmation("AI could not suggest ingredients. Please try again.", null, false);
            }
        } catch (error) {
            console.error("Error generating AI ingredients (Admin):", error);
            showConfirmation("Failed to get AI suggestions. Please try again.", null, false);
        } finally {
            setGeneratingAIIngredients(false);
        }
    };

    // NEW: Function to add an AI-suggested ingredient to Firestore if it doesn't exist
    const handleAddAIIngredientToFirestore = async (aiIng) => {
        const existingIngredientNamesLower = new Set(ingredients.map(ing => ing.name.toLowerCase()));
        if (!existingIngredientNamesLower.has(aiIng.name.toLowerCase())) {
            const newDoc = await handleAddIngredient(aiIng.name, aiIng.description);
            if (newDoc) {
                showConfirmation(`'${aiIng.name}' added to Ingredients.`, null, false);
            }
        } else {
            showConfirmation(`'${aiIng.name}' already exists in Ingredients.`, null, false);
        }
    };

    // NEW: Function to add an AI-suggested ingredient to the current mapping selection
    const handleAddAIIngredientToCurrentMapping = (aiIngName) => {
        setSelectedIngredientsForMapping(prev => {
            if (!prev.includes(aiIngName)) {
                return [...prev, aiIngName];
            }
            return prev;
        });
        showConfirmation(`'${aiIngName}' added to current mapping selection.`, null, false);
    };


    const handleAddConcern = async () => {
        if (!db) {
            console.error("handleAddConcern: Firestore db is not initialized.");
            showConfirmation("Database not initialized.", null, false);
            return;
        }
        if (newConcernName.trim() === '') {
            showConfirmation("Concern name cannot be empty.", null, false);
            return;
        }
        try {
            console.log("handleAddConcern: Attempting to add concern:", newConcernName.trim());
            const docRef = await addDoc(collection(db, `${publicDataPath}/concerns`), { name: newConcernName.trim() });
            console.log("handleAddConcern: Concern added with ID:", docRef.id);
            setNewConcernName('');
            setAiSuggestedIngredientsForAdmin([]); // Clear suggestions after adding concern
        } catch (e) {
            console.error("handleAddConcern: Error adding concern: ", e);
            showConfirmation(`Failed to add concern: ${e.message}. Please try again.`, null, false);
        }
    };
    const handleEditConcern = (concern) => {
        console.log("handleEditConcern: Editing concern:", concern);
        setEditingConcern(concern);
        setNewConcernName(concern.name);
        setAiSuggestedIngredientsForAdmin([]); // Clear suggestions when switching edit context
    };
    const handleUpdateConcern = async () => {
        if (!db) {
            console.error("handleUpdateConcern: Firestore db is not initialized.");
            showConfirmation("Database not initialized.", null, false);
            return;
        }
        if (!editingConcern || newConcernName.trim() === '') {
            showConfirmation("Concern name cannot be empty.", null, false);
            return;
        }
        try {
            console.log("handleUpdateConcern: Attempting to update concern ID:", editingConcern.id, "to name:", newConcernName.trim());
            await setDoc(doc(db, `${publicDataPath}/concerns`, editingConcern.id), { name: newConcernName.trim() });
            console.log("handleUpdateConcern: Concern updated successfully.");
            setEditingConcern(null);
            setNewConcernName('');
            setAiSuggestedIngredientsForAdmin([]); // Clear suggestions after updating concern
        } catch (e) {
            console.error("handleUpdateConcern: Error updating concern: ", e);
            showConfirmation(`Failed to update concern: ${e.message}. Please try again.`, null, false);
        }
    };
    const handleDeleteConcern = async (id) => {
        if (!db) {
            console.error("handleDeleteConcern: Firestore db is not initialized.");
            showConfirmation("Database not initialized.", null, false);
            return;
        }
        try {
            console.log("handleDeleteConcern: Attempting to delete concern ID:", id);
            await deleteDoc(doc(db, `${publicDataPath}/concerns`, id));
            console.log("handleDeleteConcern: Concern deleted successfully.");
        } catch (e) {
            console.error("handleDeleteConcern: Error deleting concern: ", e);
            showConfirmation(`Failed to delete concern: ${e.message}. Please try again.`, null, false);
        }
    };
    const handleDeleteSelectedConcerns = () => {
        if (selectedConcernIds.length === 0) { showConfirmation("No concerns selected for deletion.", null, false); return; }
        showConfirmation(`Are you sure you want to delete ${selectedConcernIds.length} selected concerns?`, async () => {
            console.log("handleDeleteSelectedConcerns: Deleting selected concerns:", selectedConcernIds);
            for (const id of selectedConcernIds) { await handleDeleteConcern(id); }
            setSelectedConcernIds([]);
            console.log("handleDeleteSelectedConcerns: Selected concerns deleted.");
        });
    };
    const handleToggleSelectConcern = (id) => {
        setSelectedConcernIds(prev => {
            const newState = prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id];
            console.log("handleToggleSelectConcern: Selected concerns now:", newState);
            return newState;
        });
    };

    const handleAddIngredient = async (name, description = '') => {
        if (!db) {
            console.error("handleAddIngredient: Firestore db is not initialized.");
            showConfirmation("Database not initialized.", null, false);
            return null;
        }
        if (name.trim() === '') {
            showConfirmation("Ingredient name cannot be empty.", null, false);
            return null;
        }
        try {
            console.log("handleAddIngredient: Attempting to add ingredient:", name.trim());
            const docRef = await addDoc(collection(db, `${publicDataPath}/ingredients`), { name: name.trim(), description: description.trim() });
            console.log("handleAddIngredient: Ingredient added with ID:", docRef.id);
            return { id: docRef.id, name: name.trim(), description: description.trim() };
        } catch (e) {
            console.error("handleAddIngredient: Error adding ingredient: ", e);
            showConfirmation(`Failed to add ingredient: ${e.message}. Please try again.`, null, false);
            return null;
        }
    };
    const handleEditIngredient = (ingredient) => {
        console.log("handleEditIngredient: Editing ingredient:", ingredient);
        setEditingIngredient(ingredient);
        setNewIngredientName(ingredient.name);
        setNewIngredientDescription(ingredient.description);
    };
    const handleUpdateIngredient = async () => {
        if (!db) {
            console.error("handleUpdateIngredient: Firestore db is not initialized.");
            showConfirmation("Database not initialized.", null, false);
            return;
        }
        if (!editingIngredient || newIngredientName.trim() === '') {
            showConfirmation("Ingredient name cannot be empty.", null, false);
            return;
        }
        try {
            console.log("handleUpdateIngredient: Attempting to update ingredient ID:", editingIngredient.id, "to name:", newIngredientName.trim());
            await setDoc(doc(db, `${publicDataPath}/ingredients`, editingIngredient.id), { name: newIngredientName.trim(), description: newIngredientDescription.trim() });
            console.log("handleUpdateIngredient: Ingredient updated successfully.");
            setEditingIngredient(null);
            setNewIngredientName('');
            setNewIngredientDescription('');
        } catch (e) {
            console.error("handleUpdateIngredient: Error updating ingredient: ", e);
            showConfirmation(`Failed to update ingredient: ${e.message}. Please try again.`, null, false);
        }
    };
    const handleDeleteIngredient = (id) => {
        showConfirmation("Are you sure you want to delete this ingredient?", async () => {
            if (!db) {
                console.error("handleDeleteIngredient: Firestore db is not initialized.");
                showConfirmation("Database not initialized.", null, false);
                return;
            }
            try {
                console.log("handleDeleteIngredient: Attempting to delete ingredient ID:", id);
                await deleteDoc(doc(db, `${publicDataPath}/ingredients`, id));
                console.log("handleDeleteIngredient: Ingredient deleted successfully.");
            } catch (e) {
                console.error("handleDeleteIngredient: Error deleting ingredient: ", e);
                showConfirmation(`Failed to delete ingredient: ${e.message}. Please try again.`, null, false);
            }
        });
    };
    const handleDeleteSelectedIngredients = () => {
        if (selectedIngredientIds.length === 0) { showConfirmation("No ingredients selected for deletion.", null, false); return; }
        showConfirmation(`Are you sure you want to delete ${selectedIngredientIds.length} selected ingredients?`, async () => {
            console.log("handleDeleteSelectedIngredients: Deleting selected ingredients:", selectedIngredientIds);
            for (const id of selectedIngredientIds) { await handleDeleteIngredient(id); }
            setSelectedIngredientIds([]);
            console.log("handleDeleteSelectedIngredients: Selected ingredients deleted.");
        });
    };
    const handleToggleSelectIngredient = (id) => {
        setSelectedIngredientIds(prev => {
            const newState = prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id];
            console.log("handleToggleSelectIngredient: Selected ingredients now:", newState);
            return newState;
        });
    };

    const handleAddProduct = async () => {
        if (!db) {
            console.error("handleAddProduct: Firestore db is not initialized.");
            showConfirmation("Database not initialized.", null, false);
            return;
        }
        if (newProductName.trim() === '') {
            showConfirmation("Product name cannot be empty.", null, false);
            return;
        }
        try {
            console.log("handleAddProduct: Attempting to add product:", newProductName.trim());
            await addDoc(collection(db, `${publicDataPath}/products`), {
                name: newProductName.trim(), description: newProductDescription.trim(),
                imageUrl: newProductImageUrl.trim(), shopifyUrl: newProductShopifyUrl.trim(),
                targetIngredients: newProductTargetIngredients,
            });
            console.log("handleAddProduct: Product added successfully.");
            setNewProductName(''); setNewProductDescription(''); setNewProductImageUrl('');
            setNewProductShopifyUrl(''); setNewProductTargetIngredients([]);
        } catch (e) {
            console.error("handleAddProduct: Error adding product: ", e);
            showConfirmation(`Failed to add product: ${e.message}. Please try again.`, null, false);
        }
    };
    const handleEditProduct = (product) => {
        console.log("handleEditProduct: Editing product:", product);
        setEditingProduct(product); setNewProductName(product.name); setNewProductDescription(product.description);
        setNewProductImageUrl(product.imageUrl); setNewProductShopifyUrl(product.shopifyUrl);
        setNewProductTargetIngredients(product.targetIngredients || []);
    };
    const handleUpdateProduct = async () => {
        if (!db) {
            console.error("handleUpdateProduct: Firestore db is not initialized.");
            showConfirmation("Database not initialized.", null, false);
            return;
        }
        if (!editingProduct || newProductName.trim() === '') {
            showConfirmation("Product name cannot be empty.", null, false);
            return;
        }
        try {
            console.log("handleUpdateProduct: Attempting to update product ID:", editingProduct.id, "to name:", newProductName.trim());
            await setDoc(doc(db, `${publicDataPath}/products`, editingProduct.id), {
                name: newProductName.trim(), description: newProductDescription.trim(),
                imageUrl: newProductImageUrl.trim(), shopifyUrl: newProductShopifyUrl.trim(),
                targetIngredients: newProductTargetIngredients,
            });
            console.log("handleUpdateProduct: Product updated successfully.");
            setEditingProduct(null); setNewProductName(''); setNewProductDescription('');
            setNewProductImageUrl(''); setNewProductShopifyUrl(''); setNewProductTargetIngredients([]);
        } catch (e) {
            console.error("handleUpdateProduct: Error updating product: ", e);
            showConfirmation(`Failed to update product: ${e.message}. Please try again.`, null, false);
        }
    };
    const handleDeleteProduct = (id) => {
        showConfirmation("Are you sure you want to delete this product?", async () => {
            if (!db) {
                console.error("handleDeleteProduct: Firestore db is not initialized.");
                showConfirmation("Database not initialized.", null, false);
                return;
            }
            try {
                console.log("handleDeleteProduct: Attempting to delete product ID:", id);
                await deleteDoc(doc(db, `${publicDataPath}/products`, id));
                console.log("handleDeleteProduct: Product deleted successfully.");
            } catch (e) {
                console.error("handleDeleteProduct: Error deleting product: ", e);
                showConfirmation(`Failed to delete product: ${e.message}. Please try again.`, null, false);
            }
        });
    };
    const handleDeleteSelectedProducts = () => {
        if (selectedProductIds.length === 0) { showConfirmation("No products selected for deletion.", null, false); return; }
        showConfirmation(`Are you sure you want to delete ${selectedProductIds.length} selected products?`, async () => {
            console.log("handleDeleteSelectedProducts: Deleting selected products:", selectedProductIds);
            for (const id of selectedProductIds) { await handleDeleteProduct(id); }
            setSelectedProductIds([]);
            console.log("handleDeleteSelectedProducts: Selected products deleted.");
        });
    };
    const handleToggleSelectProduct = (id) => {
        setSelectedProductIds(prev => {
            const newState = prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id];
            console.log("handleToggleSelectProduct: Selected products now:", newState);
            return newState;
        });
    };
    const handleIngredientSelection = (ingredientName) => {
        setNewProductTargetIngredients(prev => {
            const newState = prev.includes(ingredientName) ? prev.filter(name => name !== ingredientName) : [...prev, ingredientName];
            console.log("handleIngredientSelection: Product target ingredients now:", newState);
            return newState;
        });
    };

    const handleAddMapping = async () => {
        if (!db) {
            console.error("handleAddMapping: Firestore db is not initialized.");
            showConfirmation("Database not initialized.", null, false);
            return;
        }
        if (selectedConcernForMapping.trim() === '' || selectedIngredientsForMapping.length === 0) {
            showConfirmation("Please select a concern and at least one ingredient for mapping.", null, false);
            return;
        }
        try {
            console.log("handleAddMapping: Attempting to add mapping for concern:", selectedConcernForMapping, "with ingredients:", selectedIngredientsForMapping);
            await addDoc(collection(db, `${publicDataPath}/concerningredientMappings`), {
                concernName: selectedConcernForMapping.trim(), ingredientNames: selectedIngredientsForMapping,
            });
            console.log("handleAddMapping: Mapping added successfully.");
            setSelectedConcernForMapping(''); setSelectedIngredientsForMapping([]);
        } catch (e) {
            console.error("handleAddMapping: Error adding mapping: ", e);
            showConfirmation(`Failed to add mapping: ${e.message}. Please try again.`, null, false);
        }
    };
    const handleEditMapping = (mapping) => {
        console.log("handleEditMapping: Editing mapping:", mapping);
        setEditingMapping(mapping); setSelectedConcernForMapping(mapping.concernName); setSelectedIngredientsForMapping(mapping.ingredientNames || []);
    };
    const handleUpdateMapping = async () => {
        if (!db) {
            console.error("handleUpdateMapping: Firestore db is not initialized.");
            showConfirmation("Database not initialized.", null, false);
            return;
        }
        if (!editingMapping || selectedConcernForMapping.trim() === '' || selectedIngredientsForMapping.length === 0) {
            showConfirmation("Please select a concern and at least one ingredient for mapping.", null, false);
            return;
        }
        try {
            console.log("handleUpdateMapping: Attempting to update mapping ID:", editingMapping.id, "for concern:", selectedConcernForMapping, "with ingredients:", selectedIngredientsForMapping);
            await setDoc(doc(db, `${publicDataPath}/concerningredientMappings`, editingMapping.id), {
                concernName: selectedConcernForMapping.trim(), ingredientNames: selectedIngredientsForMapping,
            });
            console.log("handleUpdateMapping: Mapping updated successfully.");
            setEditingMapping(null); setSelectedConcernForMapping(''); setSelectedIngredientsForMapping([]);
        } catch (e) {
            console.error("handleUpdateMapping: Error updating mapping: ", e);
            showConfirmation(`Failed to update mapping: ${e.message}. Please try again.`, null, false);
        }
    };
    const handleDeleteMapping = (id) => {
        showConfirmation("Are you sure you want to delete this mapping?", async () => {
            if (!db) {
                console.error("handleDeleteMapping: Firestore db is not initialized.");
                showConfirmation("Database not initialized.", null, false);
                return;
            }
            try {
                console.log("handleDeleteMapping: Attempting to delete mapping ID:", id);
                await deleteDoc(doc(db, `${publicDataPath}/concerningredientMappings`, id));
                console.log("handleDeleteMapping: Mapping deleted successfully.");
            } catch (e) {
                console.error("handleDeleteMapping: Error deleting mapping: ", e);
                showConfirmation(`Failed to delete mapping: ${e.message}. Please try again.`, null, false);
            }
        });
    };
    const handleDeleteSelectedMappings = () => {
        if (selectedMappingIds.length === 0) { showConfirmation("No mappings selected for deletion.", null, false); return; }
        showConfirmation(`Are you sure you want to delete ${selectedMappingIds.length} selected mappings?`, async () => {
            console.log("handleDeleteSelectedMappings: Deleting selected mappings:", selectedMappingIds);
            for (const id of selectedMappingIds) { await handleDeleteMapping(id); }
            setSelectedMappingIds([]);
            console.log("handleDeleteSelectedMappings: Selected mappings deleted.");
        });
    };
    const handleToggleSelectMapping = (id) => {
        setSelectedMappingIds(prev => {
            const newState = prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id];
            console.log("handleToggleSelectMapping: Selected mappings now:", newState);
            return newState;
        });
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
            console.log("handleFetchShopifyProducts: Attempting to fetch Shopify products from domain:", shopifyStoreDomain);
            // --- SIMULATED MOCK DATA FETCH ---
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
            console.error("handleFetchShopifyProducts: Error fetching Shopify products:", error);
            showConfirmation("Failed to fetch products from Shopify. Check your domain and API key.", null, false);
        } finally {
            setFetchingShopifyProducts(false);
        }
    };


    return (
        <div className="min-h-screen bg-gray-100 font-sans text-gray-800 p-4 sm:p-6 lg:p-8">
            {userId && (
                <div className="w-full max-w-4xl bg-white p-3 rounded-lg shadow-sm mb-4 text-center text-sm text-gray-600 border border-gray-200">
                    User ID: <span className="font-mono text-purple-600">{userId}</span>
                </div>
            )}

            <header className="bg-white p-4 rounded-lg shadow-md mb-8 flex justify-between items-center">
                <h1 className="text-2xl font-bold text-indigo-700">My Beauty App</h1>
                <button
                    onClick={() => setUserRole(prevRole => (prevRole === 'customer' ? 'admin' : 'customer'))}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md shadow-sm transition-colors duration-200"
                >
                    Switch to {userRole === 'customer' ? 'Admin' : 'Customer'} View
                </button>
            </header>

            <main>
                {userRole === 'admin' && (
                    <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                        <h2 className="text-2xl font-semibold mb-4 text-gray-700">Admin Dashboard</h2>
                        <p className="text-gray-600 mb-6">Manage application settings and data here.</p>

                        <div className="flex border-b border-gray-200 mb-6">
                            <button
                                onClick={() => setActiveTab('customer')}
                                className={`py-2 px-4 text-sm font-medium ${activeTab === 'customer' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Customer View
                            </button>
                            <button
                                onClick={() => setActiveTab('admin')}
                                className={`py-2 px-4 text-sm font-medium ${activeTab === 'admin' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Admin View
                            </button>
                        </div>

                        {activeTab === 'admin' && (
                            <div className="w-full bg-gray-100 p-2 rounded-lg shadow-inner mb-6 flex justify-center space-x-4 border border-gray-200">
                                <button
                                    onClick={() => setAdminSubTab('concerns')}
                                    className={`px-4 py-2 rounded-md font-semibold transition-all duration-200 ${adminSubTab === 'concerns' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-purple-100'}`}
                                >
                                    Concerns
                                </button>
                                <button
                                    onClick={() => setAdminSubTab('ingredients')}
                                    className={`px-4 py-2 rounded-md font-semibold transition-all duration-200 ${adminSubTab === 'ingredients' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-purple-100'}`}
                                >
                                    Ingredients
                                </button>
                                <button
                                    onClick={() => setAdminSubTab('products')}
                                    className={`px-4 py-2 rounded-md font-semibold transition-all duration-200 ${adminSubTab === 'products' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-purple-100'}`}
                                >
                                    Products
                                </button>
                                <button
                                    onClick={() => setAdminSubTab('mappings')}
                                    className={`px-4 py-2 rounded-md font-semibold transition-all duration-200 ${adminSubTab === 'mappings' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-purple-100'}`}
                                >
                                    Mappings
                                </button>
                            </div>
                        )}


                        {/* Admin Sub-Tab Content */}
                        {adminSubTab === 'concerns' && (
                            <div className="space-y-6">
                                <h3 className="text-2xl font-bold text-purple-600 mb-4">Manage Concerns</h3>
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
                                        <button
                                            onClick={() => handleGenerateIngredientsForConcern(newConcernName)}
                                            disabled={generatingAIIngredients || newConcernName.trim() === ''}
                                            className="px-5 py-2 bg-indigo-500 text-white font-semibold rounded-md shadow-md hover:bg-indigo-600 transition-colors flex items-center justify-center whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {generatingAIIngredients ? (
                                                <span className="flex items-center">
                                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Suggesting...
                                                </span>
                                            ) : (
                                                <>
                                                    <Lightbulb className="w-5 h-5 mr-2" /> Suggest Ingredients (AI)
                                                </>
                                            )}
                                        </button>
                                        {editingConcern && (
                                            <button
                                                onClick={() => { setEditingConcern(null); setNewConcernName(''); setAiSuggestedIngredientsForAdmin([]); }}
                                                className="px-4 py-2 bg-gray-300 text-gray-800 font-semibold rounded-md shadow-md hover:bg-gray-400 transition-colors flex items-center justify-center whitespace-nowrap"
                                            >
                                                <X className="w-5 h-5 mr-2" /> Cancel
                                            </button>
                                        )}
                                    </div>

                                    {/* Display AI Suggested Ingredients */}
                                    {aiSuggestedIngredientsForAdmin.length > 0 && (
                                        <div className="mt-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200 shadow-inner">
                                            <h4 className="text-lg font-semibold text-indigo-700 mb-3 flex items-center">
                                                <Sparkles className="w-5 h-5 mr-2" /> AI Suggested Ingredients:
                                            </h4>
                                            <ul className="space-y-2">
                                                {aiSuggestedIngredientsForAdmin.map((aiIng, index) => (
                                                    <li key={index} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-white rounded-md border border-indigo-100 shadow-sm">
                                                        <div className="flex-grow">
                                                            <span className="font-medium text-gray-700">{aiIng.name}</span>
                                                            {aiIng.description && <p className="text-gray-500 text-sm">{aiIng.description}</p>}
                                                        </div>
                                                        <div className="flex space-x-2 mt-2 sm:mt-0">
                                                            <button
                                                                onClick={() => handleAddAIIngredientToFirestore(aiIng)}
                                                                className="px-3 py-1 bg-green-500 text-white text-xs rounded-md hover:bg-green-600 transition-colors"
                                                            >
                                                                Add to Ingredients
                                                            </button>
                                                            <button
                                                                onClick={() => handleAddAIIngredientToCurrentMapping(aiIng.name)}
                                                                className="px-3 py-1 bg-blue-500 text-white text-xs rounded-md hover:bg-blue-600 transition-colors"
                                                            >
                                                                Add to Current Mapping
                                                            </button>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
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
                                                    onClick={() => { setEditingIngredient(null); setNewIngredientName(''); setNewIngredientDescription(''); }}
                                                    className="px-4 py-2 bg-gray-300 text-gray-800 font-semibold rounded-md shadow-md hover:bg-gray-400 transition-colors flex items-center justify-center whitespace-nowrap"
                                                >
                                                    <X className="w-5 h-5 mr-2" /> Cancel
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
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
                                            placeholder="Shopify Product URL (e.g., https://yourstore.myshopify.com/products/example)"
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
                                                    onClick={() => { setNewProductName(''); setNewProductDescription(''); setNewProductImageUrl(''); setNewProductShopifyUrl(''); setNewProductTargetIngredients([]); setEditingProduct(null); }}
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
                                                            onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/50x50/CCCCCC/000000?text=Image+Error`; }}
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
                                <div className="p-4 bg-purple-50 rounded-lg border border-purple-100 shadow-inner">
                                    <h4 className="text-lg font-semibold text-purple-700 mb-3">{editingMapping ? 'Edit Mapping' : 'Add New Mapping'}</h4>
                                    <div className="flex flex-col gap-3">
                                        <select
                                            value={selectedConcernForMapping}
                                            onChange={(e) => setSelectedConcernForMapping(e.target.value)}
                                            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all duration-200"
                                        >
                                            <option value="">Select Concern</option>
                                            {concerns.map(concern => (
                                                <option key={concern.id} value={concern.name}>{concern.name}</option>
                                            ))}
                                        </select>
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
                                                    onClick={() => { setEditingMapping(null); setSelectedConcernForMapping(''); setSelectedIngredientsForMapping([]); }}
                                                    className="px-4 py-2 bg-gray-300 text-gray-800 font-semibold rounded-md shadow-md hover:bg-gray-400 transition-colors flex items-center justify-center whitespace-nowrap"
                                                >
                                                    <X className="w-5 h-5 mr-2" /> Cancel
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
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
                                    {concernIngredientMappings.length === 0 && (
                                        <p className="text-center text-gray-500 py-4">No mappings added yet.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {userRole === 'customer' && (
                    <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                        <h2 className="text-2xl font-semibold mb-4 text-gray-700">Welcome, Customer!</h2>
                        <p className="text-gray-600">Explore beauty products tailored to your needs.</p>
                        {/* Customer View Content */}
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
                                            setSelectedConcerns([]);
                                            setCurrentCustomerConcern('');
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
                                                                ? 'bg-blue-100 border-blue-600 animate-pulse'
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
                                                            {product.targetIngredients && product.targetIngredients.length > 0 && (
                                                                <p className="text-gray-500 text-xs mt-1">Key Ingredients: {product.targetIngredients.join(', ')}</p>
                                                            )}
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
                    </div>
                )}
            </main>

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
}

export default App;

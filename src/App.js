/* global __initial_auth_token */
import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, onSnapshot } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import ReactDOM from 'react-dom'; // Ensure ReactDOM is imported for portals

// Import lucide-react icons
import { PlusCircle, Trash2, Edit, Save, X, Lightbulb, User, Settings, ShoppingBag, AlignJustify } from 'lucide-react';

// Placeholder for ConfirmationModal - ensure you have this file in src/
import ConfirmationModal from './ConfirmationModal';

// Dummy content for the customer view. Replace with actual customer-facing components.
const CustomerView = ({ products, ingredients, concerns, mappings, handleCustomerFilter, handleApplyFilters, filteredProducts, handleSelectProduct, handleClearSelectedProduct, selectedProduct, handleIngredientToggle, selectedIngredients, handleApplyIngredientFilter, filterIngredients, handleResetFilters }) => (
    <div className="p-6 bg-white rounded-lg shadow-md max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-800 mb-6">Customer View</h2>

        {/* Product Search and Filters */}
        <div className="mb-8 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <h3 className="text-xl font-semibold text-gray-700 mb-4">Find Products</h3>
            <div className="flex flex-wrap gap-4 mb-4">
                <input
                    type="text"
                    placeholder="Search products..."
                    className="flex-grow p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    onChange={(e) => handleCustomerFilter(e.target.value)}
                />
                <button
                    onClick={handleApplyFilters}
                    className="px-6 py-2 bg-purple-600 text-white font-semibold rounded-md shadow-md hover:bg-purple-700 transition-colors"
                >
                    Apply Filters
                </button>
                <button
                    onClick={handleResetFilters}
                    className="px-6 py-2 bg-gray-300 text-gray-800 font-semibold rounded-md shadow-md hover:bg-gray-400 transition-colors"
                >
                    Reset Filters
                </button>
            </div>

            {/* Ingredient Filters */}
            <div className="mb-4">
                <h4 className="text-md font-semibold text-gray-600 mb-2">Filter by Ingredients:</h4>
                <div className="flex flex-wrap gap-2">
                    {ingredients.map(ingredient => (
                        <button
                            key={ingredient.id}
                            onClick={() => handleIngredientToggle(ingredient.name)}
                            className={`px-3 py-1 rounded-full text-sm transition-colors duration-200 ${selectedIngredients.includes(ingredient.name) ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                        >
                            {ingredient.name}
                        </button>
                    ))}
                </div>
                <button
                    onClick={handleApplyIngredientFilter}
                    className="mt-4 px-6 py-2 bg-blue-600 text-white font-semibold rounded-md shadow-md hover:bg-blue-700 transition-colors"
                >
                    Apply Ingredient Filters
                </button>
            </div>
        </div>

        {/* Filtered Product List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredProducts.length > 0 ? (
                filteredProducts.map(product => (
                    <div key={product.id} className="bg-gray-100 p-4 rounded-lg shadow-sm border border-gray-200">
                        <h4 className="text-lg font-bold text-gray-800">{product.name}</h4>
                        <p className="text-gray-600 text-sm mb-2">{product.description}</p>
                        <p className="text-gray-700 font-semibold">Concerns: {product.concerns.join(', ')}</p>
                        <p className="text-gray-700 font-semibold">Ingredients: {product.ingredients.join(', ')}</p>
                        <button
                            onClick={() => handleSelectProduct(product)}
                            className="mt-3 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                        >
                            View Details
                        </button>
                    </div>
                ))
            ) : (
                <p className="text-center text-gray-500 col-span-2">No products match your criteria. Try adjusting your filters.</p>
            )}
        </div>

        {/* Selected Product Detail */}
        {selectedProduct && (
            <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg shadow-lg">
                <h3 className="text-2xl font-bold text-blue-800 mb-4">{selectedProduct.name}</h3>
                <p className="text-gray-700 mb-2">{selectedProduct.description}</p>
                <p className="text-gray-700 font-semibold">Concerns Addressed: {selectedProduct.concerns.join(', ')}</p>
                <p className="text-gray-700 font-semibold">Key Ingredients: {selectedProduct.ingredients.join(', ')}</p>
                <button
                    onClick={handleClearSelectedProduct}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                    Back to Products
                </button>
            </div>
        )}
    </div>
);


// Firebase configuration and initialization
const firebaseConfig = JSON.parse(process.env.REACT_APP_FIREBASE_CONFIG);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const functions = getFunctions(app); // Initialize Cloud Functions

// Context for Auth and DB
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            if (firebaseUser) {
                // User is signed in.
                setUser(firebaseUser);
                console.log('Signed in with user ID:', firebaseUser.uid);
            } else {
                // No user is signed in.
                setUser(null);
                console.log('No user signed in.');
                // Attempt anonymous sign-in if no user is signed in
                signInAnonymously(auth)
                    .then((userCredential) => {
                        console.log('Signed in anonymously.');
                    })
                    .catch((error) => {
                        console.error('Anonymous sign-in failed:', error);
                    });
            }
            setIsAuthReady(true);
        });
        return () => unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ user, isAuthReady, db, auth, functions }}>
            {children}
        </AuthContext.Provider>
    );
};

const useAuth = () => useContext(AuthContext);

// Main App Component
const App = () => {
    const { user, isAuthReady, db, auth, functions } = useAuth();

    // State for UI management
    const [userRole, setUserRole] = useState('customer'); // 'customer' or 'admin'
    const [activeTab, setActiveTab] = useState('customer'); // 'customer', 'admin'
    const [adminSubTab, setAdminSubTab] = useState('concerns'); // 'concerns', 'ingredients', 'products', 'mappings'

    // State for data
    const [concerns, setConcerns] = useState([]);
    const [ingredients, setIngredients] = useState([]);
    const [products, setProducts] = useState([]);
    const [concernIngredientMappings, setConcernIngredientMappings] = useState([]);

    // State for CRUD operations
    const [newConcernName, setNewConcernName] = useState('');
    const [editingConcern, setEditingConcern] = useState(null); // Stores concern object being edited

    const [newIngredientName, setNewIngredientName] = useState('');
    const [editingIngredient, setEditingIngredient] = useState(null);

    const [newProductName, setNewProductName] = useState('');
    const [newProductDescription, setNewProductDescription] = useState('');
    const [selectedProductConcerns, setSelectedProductConcerns] = useState([]);
    const [selectedProductIngredients, setSelectedProductIngredients] = useState([]);
    const [editingProduct, setEditingProduct] = useState(null);

    const [selectedConcernForMapping, setSelectedConcernForMapping] = useState('');
    const [selectedIngredientsForMapping, setSelectedIngredientsForMapping] = useState([]);
    const [editingMapping, setEditingMapping] = useState(null);
    const [selectedMappingIds, setSelectedMappingIds] = useState([]); // For bulk delete

    // State for AI suggestions on admin side
    const [aiSuggestedIngredientsForAdmin, setAiSuggestedIngredientsForAdmin] = useState([]);
    const [generatingAIIngredients, setGeneratingAIIngredients] = useState(false);

    // State for customer view filters
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const [selectedIngredients, setSelectedIngredients] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null); // For product detail view
    const [filterIngredients, setFilterIngredients] = useState([]); // For ingredient filter in customer view

    // State for mapping filter
    const [mappingFilter, setMappingFilter] = useState('');


    // Confirmation Modal State
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmMessage, setConfirmMessage] = useState('');
    const [confirmAction, setConfirmAction] = useState(() => () => {}); // Callback function for confirmation
    const [confirmShowCancel, setConfirmShowCancel] = useState(true);

    const triggerConfirmation = (message, action, showCancel = true) => {
        setConfirmMessage(message);
        setConfirmAction(() => action);
        setConfirmShowCancel(showCancel);
        setShowConfirmModal(true);
    };

    const handleConfirm = () => {
        confirmAction();
        setShowConfirmModal(false);
    };

    const handleCancelConfirm = () => {
        setShowConfirmModal(false);
    };


    // Firestore Data Fetching - Realtime Listeners
    useEffect(() => {
        if (!isAuthReady || !db) {
            console.log('Data fetch skipped: Auth not ready or db not initialized.');
            return;
        }

        console.log('Data fetch useEffect triggered. isAuthReady:', isAuthReady, 'db:', !!db);

        const unsubscribeConcerns = onSnapshot(collection(db, 'concerns'), (snapshot) => {
            const concernsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setConcerns(concernsData);
            console.log('Fetched concerns:', concernsData);
            // Check if concerns collection is empty and add sample data if it is
            if (concernsData.length === 0) {
                console.log('Concerns collection is empty. Adding sample data.');
                addDoc(collection(db, 'concerns'), { name: 'Acne' });
                addDoc(collection(db, 'concerns'), { name: 'Dryness' });
                addDoc(collection(db, 'concerns'), { name: 'Aging' });
            } else {
                console.log('Concerns collection is not empty. Skipping sample data addition for concerns.');
            }
        }, (error) => {
            console.error('Error fetching concerns:', error);
        });

        const unsubscribeIngredients = onSnapshot(collection(db, 'ingredients'), (snapshot) => {
            const ingredientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setIngredients(ingredientsData);
            console.log('Fetched ingredients:', ingredientsData);
            if (ingredientsData.length === 0) {
                console.log('Ingredients collection is empty. Adding sample data.');
                addDoc(collection(db, 'ingredients'), { name: 'Salicylic Acid' });
                addDoc(collection(db, 'ingredients'), { name: 'Hyaluronic Acid' });
                addDoc(collection(db, 'ingredients'), { name: 'Retinol' });
            } else {
                console.log('Ingredients collection is not empty. Skipping sample data addition for ingredients.');
            }
        }, (error) => {
            console.error('Error fetching ingredients:', error);
        });

        const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
            const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProducts(productsData);
            console.log('Fetched products:', productsData);
            if (productsData.length === 0) {
                console.log('Products collection is empty. Adding sample data.');
                addDoc(collection(db, 'products'), {
                    name: 'Acne Clear Serum',
                    description: 'A serum designed to combat acne.',
                    concerns: ['Acne'],
                    ingredients: ['Salicylic Acid']
                });
                addDoc(collection(db, 'products'), {
                    name: 'Hydrating Cream',
                    description: 'Deeply hydrating cream for dry skin.',
                    concerns: ['Dryness'],
                    ingredients: ['Hyaluronic Acid']
                });
            } else {
                console.log('Products collection is not empty. Skipping sample data addition for products.');
            }
        }, (error) => {
            console.error('Error fetching products:', error);
        });

        const unsubscribeMappings = onSnapshot(collection(db, 'concernIngredientMappings'), (snapshot) => {
            const mappingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setConcernIngredientMappings(mappingsData);
            console.log('Fetched mappings:', mappingsData);
            // Example of adding sample data for mappings if empty
            if (mappingsData.length === 0) {
                console.log('Mappings collection is empty. Adding sample data.');
                addDoc(collection(db, 'concernIngredientMappings'), {
                    concernName: 'Acne',
                    ingredientNames: ['Salicylic Acid', 'Benzoyl Peroxide'],
                });
                addDoc(collection(db, 'concernIngredientMappings'), {
                    concernName: 'Dryness',
                    ingredientNames: ['Hyaluronic Acid', 'Glycerin'],
                });
            } else {
                console.log('Mappings collection is not empty. Skipping sample data addition for mappings.');
            }
        }, (error) => {
            console.error('Error fetching mappings:', error);
        });

        // Sample data addition verification and logging
        console.log('Sample data check/addition complete.');

        return () => {
            unsubscribeConcerns();
            unsubscribeIngredients();
            unsubscribeProducts();
            unsubscribeMappings();
        };
    }, [isAuthReady, db]);

    // Customer View Logic
    const handleCustomerFilter = useCallback((term) => {
        setCustomerSearchTerm(term.toLowerCase());
    }, []);

    const handleIngredientToggle = useCallback((ingredientName) => {
        setSelectedIngredients(prev =>
            prev.includes(ingredientName)
                ? prev.filter(name => name !== ingredientName)
                : [...prev, ingredientName]
        );
    }, []);

    const handleApplyFilters = useCallback(() => {
        let filtered = products;

        if (customerSearchTerm) {
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(customerSearchTerm) ||
                p.description.toLowerCase().includes(customerSearchTerm) ||
                p.concerns.some(c => c.toLowerCase().includes(customerSearchTerm)) ||
                p.ingredients.some(i => i.toLowerCase().includes(customerSearchTerm))
            );
        }
        setFilteredProducts(filtered);
    }, [products, customerSearchTerm]);

    const handleApplyIngredientFilter = useCallback(() => {
        let filtered = products;

        if (selectedIngredients.length > 0) {
            filtered = filtered.filter(product =>
                selectedIngredients.every(selectedIng =>
                    product.ingredients.some(productIng => productIng.toLowerCase() === selectedIng.toLowerCase())
                )
            );
        }
        setFilteredProducts(filtered);
    }, [products, selectedIngredients]);


    const handleResetFilters = useCallback(() => {
        setCustomerSearchTerm('');
        setSelectedIngredients([]);
        setFilteredProducts(products); // Reset to all products
    }, [products]);

    useEffect(() => {
        setFilteredProducts(products); // Initialize filtered products when products data loads
    }, [products]);

    const handleSelectProduct = useCallback((product) => {
        setSelectedProduct(product);
    }, []);

    const handleClearSelectedProduct = useCallback(() => {
        setSelectedProduct(null);
    }, []);

    // Admin View - CRUD Operations

    // Concerns
    const handleAddConcern = async () => {
        if (newConcernName.trim() === '') return;
        try {
            if (editingConcern) {
                const concernRef = doc(db, 'concerns', editingConcern.id);
                await updateDoc(concernRef, { name: newConcernName.trim() });
                setEditingConcern(null);
                alert('Concern updated successfully!');
            } else {
                await addDoc(collection(db, 'concerns'), { name: newConcernName.trim() });
                alert('Concern added successfully!');
            }
            setNewConcernName('');
            setAiSuggestedIngredientsForAdmin([]); // Clear AI suggestions when adding/editing a concern
        } catch (e) {
            console.error('Error adding/updating concern: ', e);
            alert('Error adding/updating concern.');
        }
    };

    const handleEditConcern = (concern) => {
        setNewConcernName(concern.name);
        setEditingConcern(concern);
        setAiSuggestedIngredientsForAdmin([]); // Clear AI suggestions when editing a concern
    };

    const handleDeleteConcern = (id) => {
        triggerConfirmation('Are you sure you want to delete this concern? This action cannot be undone.', async () => {
            try {
                await deleteDoc(doc(db, 'concerns', id));
                alert('Concern deleted successfully!');
            } catch (e) {
                console.error('Error deleting concern: ', e);
                alert('Error deleting concern.');
            }
        });
    };

    // Ingredients
    const handleAddIngredient = async () => {
        if (newIngredientName.trim() === '') return;
        try {
            if (editingIngredient) {
                const ingredientRef = doc(db, 'ingredients', editingIngredient.id);
                await updateDoc(ingredientRef, { name: newIngredientName.trim() });
                setEditingIngredient(null);
                alert('Ingredient updated successfully!');
            } else {
                await addDoc(collection(db, 'ingredients'), { name: newIngredientName.trim() });
                alert('Ingredient added successfully!');
            }
            setNewIngredientName('');
        } catch (e) {
            console.error('Error adding/updating ingredient: ', e);
            alert('Error adding/updating ingredient.');
        }
    };

    const handleEditIngredient = (ingredient) => {
        setNewIngredientName(ingredient.name);
        setEditingIngredient(ingredient);
    };

    const handleDeleteIngredient = (id) => {
        triggerConfirmation('Are you sure you want to delete this ingredient? This action cannot be undone.', async () => {
            try {
                await deleteDoc(doc(db, 'ingredients', id));
                alert('Ingredient deleted successfully!');
            } catch (e) {
                console.error('Error deleting ingredient: ', e);
                alert('Error deleting ingredient.');
            }
        });
    };

    // Products
    const handleAddProduct = async () => {
        if (newProductName.trim() === '') return;
        if (selectedProductConcerns.length === 0 || selectedProductIngredients.length === 0) {
            alert('Please select at least one concern and one ingredient for the product.');
            return;
        }

        try {
            if (editingProduct) {
                const productRef = doc(db, 'products', editingProduct.id);
                await updateDoc(productRef, {
                    name: newProductName.trim(),
                    description: newProductDescription.trim(),
                    concerns: selectedProductConcerns,
                    ingredients: selectedProductIngredients,
                });
                setEditingProduct(null);
                alert('Product updated successfully!');
            } else {
                await addDoc(collection(db, 'products'), {
                    name: newProductName.trim(),
                    description: newProductDescription.trim(),
                    concerns: selectedProductConcerns,
                    ingredients: selectedProductIngredients,
                });
                alert('Product added successfully!');
            }
            setNewProductName('');
            setNewProductDescription('');
            setSelectedProductConcerns([]);
            setSelectedProductIngredients([]);
        } catch (e) {
            console.error('Error adding/updating product: ', e);
            alert('Error adding/updating product.');
        }
    };

    const handleEditProduct = (product) => {
        setNewProductName(product.name);
        setNewProductDescription(product.description);
        setSelectedProductConcerns(product.concerns || []);
        setSelectedProductIngredients(product.ingredients || []);
        setEditingProduct(product);
    };

    const handleDeleteProduct = (id) => {
        triggerConfirmation('Are you sure you want to delete this product? This action cannot be undone.', async () => {
            try {
                await deleteDoc(doc(db, 'products', id));
                alert('Product deleted successfully!');
            } catch (e) {
                console.error('Error deleting product: ', e);
                alert('Error deleting product.');
            }
        });
    };

    const handleToggleProductConcern = (concernName) => {
        setSelectedProductConcerns(prev =>
            prev.includes(concernName)
                ? prev.filter(name => name !== concernName)
                : [...prev, concernName]
        );
    };

    const handleToggleProductIngredient = (ingredientName) => {
        setSelectedProductIngredients(prev =>
            prev.includes(ingredientName)
                ? prev.filter(name => name !== ingredientName)
                : [...prev, ingredientName]
        );
    };

    // Mappings
    const handleAddMapping = async () => {
        if (selectedConcernForMapping === '' || selectedIngredientsForMapping.length === 0) {
            alert('Please select a concern and at least one ingredient for the mapping.');
            return;
        }

        // --- DEBUGGING LOGS ---
        console.log("Attempting to add mapping:");
        console.log("  Concern:", selectedConcernForMapping);
        console.log("  Ingredients (from state):", selectedIngredientsForMapping);
        // --- END DEBUGGING LOGS ---

        try {
            if (editingMapping) {
                const mappingRef = doc(db, 'concernIngredientMappings', editingMapping.id);
                await updateDoc(mappingRef, {
                    concernName: selectedConcernForMapping,
                    ingredientNames: selectedIngredientsForMapping,
                });
                setEditingMapping(null);
                alert('Mapping updated successfully!');
            } else {
                await addDoc(collection(db, 'concernIngredientMappings'), {
                    concernName: selectedConcernForMapping,
                    ingredientNames: selectedIngredientsForMapping,
                });
                alert('Mapping added successfully!');
            }
            setSelectedConcernForMapping('');
            setSelectedIngredientsForMapping([]);
            setAiSuggestedIngredientsForAdmin([]); // Clear AI suggestions after adding/updating mapping
        } catch (e) {
            console.error('Error adding/updating mapping: ', e);
            alert('Error adding/updating mapping.');
        }
    };

    const handleEditMapping = (mapping) => {
        setSelectedConcernForMapping(mapping.concernName);
        setSelectedIngredientsForMapping(mapping.ingredientNames || []);
        setEditingMapping(mapping);
    };

    const handleDeleteMapping = (id) => {
        triggerConfirmation('Are you sure you want to delete this mapping? This action cannot be undone.', async () => {
            try {
                await deleteDoc(doc(db, 'concernIngredientMappings', id));
                alert('Mapping deleted successfully!');
            } catch (e) {
                console.error('Error deleting mapping: ', e);
                alert('Error deleting mapping.');
            }
        });
    };

    const handleToggleSelectMapping = (id) => {
        setSelectedMappingIds(prev =>
            prev.includes(id)
                ? prev.filter(mappingId => mappingId !== id)
                : [...prev, id]
        );
    };

    const handleDeleteSelectedMappings = () => {
        if (selectedMappingIds.length === 0) {
            alert('Please select mappings to delete.');
            return;
        }

        triggerConfirmation(`Are you sure you want to delete ${selectedMappingIds.length} selected mappings? This action cannot be undone.`, async () => {
            try {
                const deletePromises = selectedMappingIds.map(id => deleteDoc(doc(db, 'concernIngredientMappings', id)));
                await Promise.all(deletePromises);
                setSelectedMappingIds([]);
                alert('Selected mappings deleted successfully!');
            } catch (e) {
                console.error('Error deleting selected mappings: ', e);
                alert('Error deleting selected mappings.');
            }
        });
    };

    const handleIngredientToggleForMapping = (ingredientName) => {
        setSelectedIngredientsForMapping(prev =>
            prev.includes(ingredientName)
                ? prev.filter(name => name !== ingredientName)
                : [...prev, ingredientName]
        );
    };

    // Admin AI Integration
    const handleGenerateIngredientsForConcern = async (concernName) => {
        if (!concernName) {
            alert('Please select a concern first.');
            return;
        }
        setGeneratingAIIngredients(true);
        setAiSuggestedIngredientsForAdmin([]); // Clear previous suggestions

        try {
            const generateIngredients = httpsCallable(functions, 'generateIngredientsForConcern');
            const result = await generateIngredients({ concern: concernName });
            console.log('AI suggestion result:', result.data.ingredients);
            setAiSuggestedIngredientsForAdmin(result.data.ingredients || []);
        } catch (error) {
            console.error('Error calling AI function:', error);
            alert('Failed to generate AI suggestions. Please check Cloud Function logs.');
        } finally {
            setGeneratingAIIngredients(false);
        }
    };

    const handleAddAIIngredientToFirestore = async (ingredientName) => {
        if (!ingredientName) return;

        // Check if ingredient already exists in Firestore
        const q = query(collection(db, 'ingredients'), where('name', '==', ingredientName));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            try {
                await addDoc(collection(db, 'ingredients'), { name: ingredientName });
                alert(`'${ingredientName}' added to Ingredients!`);
            } catch (e) {
                console.error('Error adding AI ingredient to Firestore:', e);
                alert('Failed to add AI ingredient to Firestore.');
            }
        } else {
            alert(`'${ingredientName}' already exists in Ingredients.`);
        }
    };

    const handleAddAIIngredientToCurrentMapping = (ingredientName) => {
        // Add to selectedIngredientsForMapping if not already present
        if (!selectedIngredientsForMapping.includes(ingredientName)) {
            setSelectedIngredientsForMapping(prev => [...prev, ingredientName]);
            alert(`'${ingredientName}' added to current mapping selection!`);
        } else {
            alert(`'${ingredientName}' is already selected for mapping.`);
        }
    };

    // User Login/Logout (for admin access)
    const handleAdminLogin = async () => {
        // You would typically have a login form here.
        // For demonstration, using hardcoded credentials (NOT for production!)
        try {
            // Replace with actual email/password if using. For now, it will likely fall back to anonymous.
            // await signInWithEmailAndPassword(auth, 'admin@example.com', 'password123');
            alert('Admin logged in! (Note: Using anonymous sign-in for demo)');
            setUserRole('admin'); // Set role on successful login
        } catch (error) {
            console.error('Admin login failed:', error);
            alert('Admin login failed: ' + error.message);
        }
    };

    const handleAdminLogout = async () => {
        try {
            await signOut(auth);
            alert('Logged out.');
            setUserRole('customer'); // Revert to customer role on logout
            setActiveTab('customer'); // Switch to customer view on logout
        } catch (error) {
            console.error('Error logging out:', error);
            alert('Logout failed.');
        }
    };


    // Render logic
    if (!isAuthReady) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <p className="text-xl text-gray-700">Loading application...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 p-8 flex flex-col items-center">
            <h1 className="text-4xl font-extrabold text-purple-800 mb-8">Beauty Product Recommender</h1>

            {/* Main Tabs */}
            <div className="flex mb-8 space-x-4">
                <button
                    onClick={() => setActiveTab('customer')}
                    className={`px-6 py-3 rounded-lg font-semibold transition-colors ${activeTab === 'customer' ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >
                    <User className="inline-block mr-2 w-5 h-5" /> Customer View
                </button>
                <button
                    onClick={() => {
                        if (userRole === 'admin') {
                            setActiveTab('admin');
                        } else {
                            // Prompt for admin login
                            // For simplicity, directly calling a login function here.
                            // In a real app, this would open a modal/redirect to a login page.
                            handleAdminLogin();
                        }
                    }}
                    className={`px-6 py-3 rounded-lg font-semibold transition-colors ${activeTab === 'admin' && userRole === 'admin' ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >
                    <Settings className="inline-block mr-2 w-5 h-5" /> Admin Portal
                </button>
            </div>

            {/* Conditional Rendering based on activeTab */}
            <div className="w-full max-w-6xl">
                {activeTab === 'customer' && (
                    <CustomerView
                        products={products}
                        ingredients={ingredients}
                        concerns={concerns}
                        mappings={concernIngredientMappings}
                        handleCustomerFilter={handleCustomerFilter}
                        handleApplyFilters={handleApplyFilters}
                        filteredProducts={filteredProducts}
                        handleSelectProduct={handleSelectProduct}
                        handleClearSelectedProduct={handleClearSelectedProduct}
                        handleIngredientToggle={handleIngredientToggle}
                        selectedIngredients={selectedIngredients}
                        handleApplyIngredientFilter={handleApplyIngredientFilter}
                        filterIngredients={filterIngredients}
                        handleResetFilters={handleResetFilters}
                    />
                )}

                {activeTab === 'admin' && userRole === 'admin' && (
                    <>
                        <div className="flex mb-6 space-x-4 p-4 bg-purple-50 rounded-lg shadow-inner">
                            <button
                                onClick={() => setAdminSubTab('concerns')}
                                className={`px-4 py-2 rounded-md font-medium transition-colors ${adminSubTab === 'concerns' ? 'bg-purple-700 text-white' : 'bg-purple-200 text-purple-800 hover:bg-purple-300'}`}
                            >
                                <AlignJustify className="inline-block mr-2 w-4 h-4" />Manage Concerns
                            </button>
                            <button
                                onClick={() => setAdminSubTab('ingredients')}
                                className={`px-4 py-2 rounded-md font-medium transition-colors ${adminSubTab === 'ingredients' ? 'bg-purple-700 text-white' : 'bg-purple-200 text-purple-800 hover:bg-purple-300'}`}
                            >
                                <AlignJustify className="inline-block mr-2 w-4 h-4" />Manage Ingredients
                            </button>
                            <button
                                onClick={() => setAdminSubTab('products')}
                                className={`px-4 py-2 rounded-md font-medium transition-colors ${adminSubTab === 'products' ? 'bg-purple-700 text-white' : 'bg-purple-200 text-purple-800 hover:bg-purple-300'}`}
                            >
                                <ShoppingBag className="inline-block mr-2 w-4 h-4" />Manage Products
                            </button>
                            <button
                                onClick={() => setAdminSubTab('mappings')}
                                className={`px-4 py-2 rounded-md font-medium transition-colors ${adminSubTab === 'mappings' ? 'bg-purple-700 text-white' : 'bg-purple-200 text-purple-800 hover:bg-purple-300'}`}
                            >
                                <AlignJustify className="inline-block mr-2 w-4 h-4" />Manage Mappings
                            </button>
                        </div>

                        {/* Admin Sub-Tabs Content */}
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            {/* Concerns Tab */}
                            {adminSubTab === 'concerns' && (
                                <div className="space-y-6">
                                    <h3 className="text-2xl font-semibold text-gray-800 mb-4">Manage Concerns</h3>
                                    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                                        <input
                                            type="text"
                                            placeholder="New Concern Name"
                                            value={newConcernName}
                                            onChange={(e) => setNewConcernName(e.target.value)}
                                            className="w-full p-2 border border-gray-300 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                        <div className="flex space-x-3">
                                            <button
                                                onClick={handleAddConcern}
                                                className="flex-grow px-5 py-2 bg-purple-600 text-white font-semibold rounded-md shadow-md hover:bg-purple-700 transition-colors"
                                            >
                                                {editingConcern ? <Save className="w-5 h-5 mr-2" /> : <PlusCircle className="w-5 h-5 mr-2" />}
                                                {editingConcern ? 'Update Concern' : 'Add Concern'}
                                            </button>
                                            {editingConcern && (
                                                <button
                                                    onClick={() => { setNewConcernName(''); setEditingConcern(null); setAiSuggestedIngredientsForAdmin([]); }}
                                                    className="px-4 py-2 bg-gray-300 text-gray-800 font-semibold rounded-md shadow-md hover:bg-gray-400 transition-colors"
                                                >
                                                    <X className="w-5 h-5 mr-2" /> Cancel
                                                </button>
                                            )}
                                        </div>

                                        {/* AI Ingredient Suggestions Button */}
                                        <button
                                            onClick={() => handleGenerateIngredientsForConcern(newConcernName)}
                                            disabled={!newConcernName || generatingAIIngredients}
                                            className={`mt-4 w-full px-5 py-2 flex items-center justify-center font-semibold rounded-md shadow-md transition-colors ${!newConcernName || generatingAIIngredients ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                        >
                                            {generatingAIIngredients ? (
                                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                            ) : (
                                                <Lightbulb className="w-5 h-5 mr-2" />
                                            )}
                                            {generatingAIIngredients ? 'Generating...' : 'Suggest Ingredients (AI)'}
                                        </button>

                                        {/* Display AI Suggested Ingredients */}
                                        {aiSuggestedIngredientsForAdmin.length > 0 && (
                                            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                                                <h5 className="font-semibold text-blue-800 mb-2">AI Suggested Ingredients for "{newConcernName}":</h5>
                                                <div className="flex flex-wrap gap-2">
                                                    {aiSuggestedIngredientsForAdmin.map((ingredient, index) => (
                                                        <div key={index} className="flex items-center bg-blue-100 text-blue-900 rounded-full px-3 py-1 text-sm">
                                                            <span>{ingredient}</span>
                                                            <button
                                                                onClick={() => handleAddAIIngredientToFirestore(ingredient)}
                                                                className="ml-2 text-blue-600 hover:text-blue-800 transition-colors font-medium text-xs"
                                                                title="Add to Ingredients List"
                                                            >
                                                                + Ing
                                                            </button>
                                                            <button
                                                                onClick={() => handleAddAIIngredientToCurrentMapping(ingredient)}
                                                                className="ml-1 text-purple-600 hover:text-purple-800 transition-colors font-medium text-xs"
                                                                title="Add to Current Mapping"
                                                            >
                                                                + Map
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Concerns List */}
                                    <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-md">
                                        <h4 className="text-lg font-semibold text-gray-800 mb-4">Existing Concerns ({concerns.length})</h4>
                                        <ul className="space-y-2">
                                            {concerns.map(concern => (
                                                <li key={concern.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200 shadow-sm">
                                                    <span className="font-medium text-gray-700">{concern.name}</span>
                                                    <div className="flex space-x-2">
                                                        <button onClick={() => handleEditConcern(concern)} className="text-blue-600 hover:text-blue-800 transition-colors">
                                                            <Edit className="w-5 h-5" />
                                                        </button>
                                                        <button onClick={() => handleDeleteConcern(concern.id)} className="text-red-600 hover:text-red-800 transition-colors">
                                                            <Trash2 className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {/* Ingredients Tab */}
                            {adminSubTab === 'ingredients' && (
                                <div className="space-y-6">
                                    <h3 className="text-2xl font-semibold text-gray-800 mb-4">Manage Ingredients</h3>
                                    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                                        <input
                                            type="text"
                                            placeholder="New Ingredient Name"
                                            value={newIngredientName}
                                            onChange={(e) => setNewIngredientName(e.target.value)}
                                            className="w-full p-2 border border-gray-300 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                        <div className="flex space-x-3">
                                            <button
                                                onClick={handleAddIngredient}
                                                className="flex-grow px-5 py-2 bg-purple-600 text-white font-semibold rounded-md shadow-md hover:bg-purple-700 transition-colors"
                                            >
                                                {editingIngredient ? <Save className="w-5 h-5 mr-2" /> : <PlusCircle className="w-5 h-5 mr-2" />}
                                                {editingIngredient ? 'Update Ingredient' : 'Add Ingredient'}
                                            </button>
                                            {editingIngredient && (
                                                <button
                                                    onClick={() => { setNewIngredientName(''); setEditingIngredient(null); }}
                                                    className="px-4 py-2 bg-gray-300 text-gray-800 font-semibold rounded-md shadow-md hover:bg-gray-400 transition-colors"
                                                >
                                                    <X className="w-5 h-5 mr-2" /> Cancel
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Ingredients List */}
                                    <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-md">
                                        <h4 className="text-lg font-semibold text-gray-800 mb-4">Existing Ingredients ({ingredients.length})</h4>
                                        <ul className="space-y-2">
                                            {ingredients.map(ingredient => (
                                                <li key={ingredient.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200 shadow-sm">
                                                    <span className="font-medium text-gray-700">{ingredient.name}</span>
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
                                    </div>
                                </div>
                            )}

                            {/* Products Tab */}
                            {adminSubTab === 'products' && (
                                <div className="space-y-6">
                                    <h3 className="text-2xl font-semibold text-gray-800 mb-4">Manage Products</h3>
                                    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                                        <input
                                            type="text"
                                            placeholder="Product Name"
                                            value={newProductName}
                                            onChange={(e) => setNewProductName(e.target.value)}
                                            className="w-full p-2 border border-gray-300 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                        <textarea
                                            placeholder="Product Description"
                                            value={newProductDescription}
                                            onChange={(e) => setNewProductDescription(e.target.value)}
                                            className="w-full p-2 border border-gray-300 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[80px]"
                                        />
                                        <div className="mb-3">
                                            <h4 className="text-md font-semibold text-gray-600 mb-2">Select Concerns:</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {concerns.map(concern => (
                                                    <button
                                                        key={concern.id}
                                                        onClick={() => handleToggleProductConcern(concern.name)}
                                                        className={`px-3 py-1 rounded-full text-sm transition-colors duration-200 ${selectedProductConcerns.includes(concern.name) ? 'bg-purple-200 text-purple-800' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                                                    >
                                                        {concern.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="mb-3">
                                            <h4 className="text-md font-semibold text-gray-600 mb-2">Select Ingredients:</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {ingredients.map(ingredient => (
                                                    <button
                                                        key={ingredient.id}
                                                        onClick={() => handleToggleProductIngredient(ingredient.name)}
                                                        className={`px-3 py-1 rounded-full text-sm transition-colors duration-200 ${selectedProductIngredients.includes(ingredient.name) ? 'bg-teal-200 text-teal-800' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                                                    >
                                                        {ingredient.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex space-x-3">
                                            <button
                                                onClick={handleAddProduct}
                                                className="flex-grow px-5 py-2 bg-purple-600 text-white font-semibold rounded-md shadow-md hover:bg-purple-700 transition-colors"
                                            >
                                                {editingProduct ? <Save className="w-5 h-5 mr-2" /> : <PlusCircle className="w-5 h-5 mr-2" />}
                                                {editingProduct ? 'Update Product' : 'Add Product'}
                                            </button>
                                            {editingProduct && (
                                                <button
                                                    onClick={() => { setNewProductName(''); setNewProductDescription(''); setSelectedProductConcerns([]); setSelectedProductIngredients([]); setEditingProduct(null); }}
                                                    className="px-4 py-2 bg-gray-300 text-gray-800 font-semibold rounded-md shadow-md hover:bg-gray-400 transition-colors"
                                                >
                                                    <X className="w-5 h-5 mr-2" /> Cancel
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Products List */}
                                    <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-md">
                                        <h4 className="text-lg font-semibold text-gray-800 mb-4">Existing Products ({products.length})</h4>
                                        <ul className="space-y-3">
                                            {products.map(product => (
                                                <li key={product.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-md border border-gray-200 shadow-sm">
                                                    <div>
                                                        <p className="font-medium text-gray-700">{product.name}</p>
                                                        <p className="text-gray-500 text-sm">{product.description}</p>
                                                        <p className="text-gray-600 text-xs">Concerns: {product.concerns.join(', ')}</p>
                                                        <p className="text-gray-600 text-xs">Ingredients: {product.ingredients.join(', ')}</p>
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
                                    </div>
                                </div>
                            )}

                            {/* Mappings Tab */}
                            {adminSubTab === 'mappings' && (
                                <div className="space-y-6">
                                    <h3 className="text-2xl font-semibold text-gray-800 mb-4">Manage Mappings</h3>
                                    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                                        <div className="mb-3">
                                            <h4 className="text-md font-semibold text-gray-600 mb-2">Select Concern:</h4>
                                            <select
                                                value={selectedConcernForMapping}
                                                onChange={(e) => {
                                                    setSelectedConcernForMapping(e.target.value);
                                                    setAiSuggestedIngredientsForAdmin([]); // Clear AI suggestions when selecting a new concern for mapping
                                                }}
                                                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            >
                                                <option value="">-- Select a Concern --</option>
                                                {concerns.map(concern => (
                                                    <option key={concern.id} value={concern.name}>
                                                        {concern.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {selectedConcernForMapping && (
                                                <button
                                                    onClick={() => handleGenerateIngredientsForConcern(selectedConcernForMapping)}
                                                    disabled={generatingAIIngredients}
                                                    className={`mt-3 w-full px-4 py-2 flex items-center justify-center font-semibold rounded-md shadow-md transition-colors ${generatingAIIngredients ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                                >
                                                    {generatingAIIngredients ? (
                                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                    ) : (
                                                        <Lightbulb className="w-5 h-5 mr-2" />
                                                    )}
                                                    {generatingAIIngredients ? 'Generating...' : 'Suggest Ingredients (AI) for this Concern'}
                                                </button>
                                            )}
                                        </div>

                                        {aiSuggestedIngredientsForAdmin.length > 0 && (
                                            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md mb-3">
                                                <h5 className="font-semibold text-blue-800 mb-2">AI Suggested Ingredients for "{selectedConcernForMapping}":</h5>
                                                <div className="flex flex-wrap gap-2">
                                                    {aiSuggestedIngredientsForAdmin.map((ingredient, index) => (
                                                        <div key={index} className="flex items-center bg-blue-100 text-blue-900 rounded-full px-3 py-1 text-sm">
                                                            <span>{ingredient}</span>
                                                            <button
                                                                onClick={() => handleAddAIIngredientToFirestore(ingredient)}
                                                                className="ml-2 text-blue-600 hover:text-blue-800 transition-colors font-medium text-xs"
                                                                title="Add to Ingredients List"
                                                            >
                                                                + Ing
                                                            </button>
                                                            <button
                                                                onClick={() => handleAddAIIngredientToCurrentMapping(ingredient)}
                                                                className="ml-1 text-purple-600 hover:text-purple-800 transition-colors font-medium text-xs"
                                                                title="Add to Current Mapping"
                                                            >
                                                                + Map
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="mb-3">
                                            <h4 className="text-md font-semibold text-gray-600 mb-2">Select Ingredients:</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {ingredients.map(ingredient => (
                                                    <button
                                                        key={ingredient.id}
                                                        onClick={() => handleIngredientToggleForMapping(ingredient.name)}
                                                        className={`px-3 py-1 rounded-full text-sm transition-colors duration-200 ${selectedIngredientsForMapping.includes(ingredient.name) ? 'bg-pink-200 text-pink-800' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
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
                                                    onClick={() => { setEditingMapping(null); setSelectedConcernForMapping(''); setSelectedIngredientsForMapping([]); setAiSuggestedIngredientsForAdmin([]); }}
                                                    className="px-4 py-2 bg-gray-300 text-gray-800 font-semibold rounded-md shadow-md hover:bg-gray-400 transition-colors flex items-center justify-center whitespace-nowrap"
                                                >
                                                    <X className="w-5 h-5 mr-2" /> Cancel
                                                </button>
                                            )}
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
                                        {concernIngredientMappings.length === 0 && (
                                            <p className="text-center text-gray-500 py-4">No mappings added yet.</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
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
                        className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg shadow-md hover:bg-gray-400 transition-colors"
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

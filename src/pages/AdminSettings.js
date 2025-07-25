import React, { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";
import "./App.css";

const firebaseConfig = JSON.parse(process.env.REACT_APP_FIREBASE_CONFIG);
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);

// Hardcoded for now
const storeId = "ask-taylah.myshopify.com";

function App() {
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ingredients, setIngredients] = useState([]);
  const [products, setProducts] = useState([]);
  const [aiResponse, setAiResponse] = useState("");
  const [category, setCategory] = useState("Beauty"); // default fallback

  useEffect(() => {
    const fetchIngredients = async () => {
      const ingredientsSnapshot = await getDocs(collection(db, "ingredients"));
      const ingredientList = ingredientsSnapshot.docs.map((doc) => doc.data());
      setIngredients(ingredientList);
    };

    const fetchCategory = async () => {
      const docRef = doc(db, "storeSettings", storeId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.category) setCategory(data.category);
      }
    };

    fetchIngredients();
    fetchCategory();
  }, []);

  const handleInputChange = (e) => {
    setUserInput(e.target.value);
  };

  const handleSearch = async () => {
    setLoading(true);

    const matchingIngredients = ingredients.filter((ingredient) =>
      ingredient.concerns?.some((concern) =>
        userInput.toLowerCase().includes(concern.toLowerCase())
      )
    );

    const matchingIngredientNames = matchingIngredients.map((i) => i.name);

    const allProductsSnapshot = await getDocs(collection(db, "products"));
    const allProducts = allProductsSnapshot.docs.map((doc) => doc.data());

    const recommendedProducts = allProducts.filter((product) =>
      product.ingredients?.some((ingredient) =>
        matchingIngredientNames.includes(ingredient)
      )
    );

    const productList = recommendedProducts
      .map((product) => `- ${product.name} (${product.ingredients.join(", ")})`)
      .join("\n");

    const prompt = `
You are an expert in ${category}.
A customer has this concern: "${userInput}".
Based on that, here are helpful ingredients: ${matchingIngredientNames.join(", ")}.
Here are the matching products in store:
${productList}

Recommend the top 3 products and explain why they suit this concern within the context of ${category}.`;

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      setAiResponse(text);
      setProducts(recommendedProducts);
    } catch (error) {
      console.error("Error generating AI response:", error);
      setAiResponse("Something went wrong with AI response.");
    }

    setLoading(false);
  };

  return (
    <div className="App">
      <h1>Ask Taylah</h1>
      <p>Category: <strong>{category}</strong></p>
      <p>Enter your concern below to get personalised product advice.</p>
      <input
        type="text"
        placeholder={`e.g. acne, dry hands, pests, sunburn`}
        value={userInput}
        onChange={handleInputChange}
      />
      <button onClick={handleSearch}>Get Recommendations</button>

      {loading && <p>Loading recommendations...</p>}

      {!loading && aiResponse && (
        <>
          <h2>AI Recommendation</h2>
          <pre>{aiResponse}</pre>
        </>
      )}

      {!loading && products.length > 0 && (
        <>
          <h2>Matching Products</h2>
          <ul>
            {products.map((product, idx) => (
              <li key={idx}>
                <strong>{product.name}</strong>: {product.ingredients.join(", ")}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default App;

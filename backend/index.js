const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const admin = require("firebase-admin");
const jwt = require("jsonwebtoken");
require("dotenv").config();


// Inicializar Firebase Admin SDK
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://jrc-quotesgenerator-default-rtdb.firebaseio.com", // Reemplaza con tu URL de Firestore
});

const db = admin.firestore();

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post("/validate-token", (req, res) => {
    const { token } = req.body;
  
    if (!token) {
      return res.status(401).json({ error: "Token no proporcionado" });
    }
  
    try {
      const decoded = jwt.verify(token, process.env.SECRET_KEY || "secretKey");
      res.status(200).json({ valid: true, user: decoded });
    } catch (error) {
      res.status(401).json({ valid: false, error: "Token inválido o expirado" });
    }
  });
  
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email y contraseña son requeridos." });
  }

  try {
    const usersCollection = db.collection("Users");
    const querySnapshot = await usersCollection.where("email", "==", email).get();

    if (querySnapshot.empty) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();

    if (userData.password !== password) {
      return res.status(401).json({ error: "Contraseña incorrecta." });
    }

    const isAdmin = userData.role === "admin";

    // Generar token JWT
    const token = jwt.sign(
        {
          email: userData.email,
          role: userData.role,
          fullName: userData.fullName,
        },
        process.env.SECRET_KEY, // Usar la clave del archivo .env
        { expiresIn: "1h" } // Token válido por 1 hora
      );
      
      const decoded = jwt.verify(token, process.env.SECRET_KEY); // También para validación
      

    res.status(200).json({
      message: "Inicio de sesión exitoso.",
      token,
      isAdmin,
      user: {
        email: userData.email,
        fullName: userData.fullName,
        role: userData.role,
      },
    });
  } catch (error) {
    console.error("Error en el inicio de sesión:", error);
    res.status(500).json({ error: "Error en el servidor." });
  }
});

app.post("/save-quotation", async (req, res) => {
    try {
      console.log("Datos recibidos:", req.body);
  
      const {
        tipoPlan,
        planSeleccionado,
        featuresSeleccionadas,
        extraFeatures,
        precioBase,
        tipoPersona,
        manejoPlanilla,
        colaboradores,
        facturas,
        facturasEmitidas,
        facturasRecibidas,
        transacciones,
        totalCost,
        user, // Información del usuario que creó la cotización
        cliente, // Información del cliente
      } = req.body;
  
      if (!tipoPlan || !cliente || !user) {
        return res.status(400).json({
          success: false,
          error: "Faltan datos requeridos (tipoPlan, cliente o user).",
        });
      }
      
      if (!cliente.nombre || !cliente.apellido || !cliente.correo) {
        return res.status(400).json({
          success: false,
          error: "Faltan datos requeridos del cliente.",
        });
      }
      
      // Aquí puedes validar los datos antes de guardarlos
      if (
        !tipoPlan ||
        !cliente ||
        !cliente.nombre ||
        !cliente.apellido ||
        !cliente.cedula ||
        !cliente.correo ||
        !cliente.telefono
      ) {
        return res.status(400).json({
          success: false,
          error: "Faltan datos requeridos en la solicitud.",
        });
      }
  
      const newQuotation = {
        tipoPlan,
        planSeleccionado,
        featuresSeleccionadas,
        extraFeatures,
        precioBase,
        tipoPersona,
        manejoPlanilla,
        colaboradores,
        facturas,
        facturasEmitidas,
        facturasRecibidas,
        transacciones,
        totalCost,
        user: {
          email: user.email,
          fullName: user.fullName,
        },
        cliente: {
          nombre: cliente.nombre,
          apellido: cliente.apellido,
          cedula: cliente.cedula,
          correo: cliente.correo,
          telefono: cliente.telefono,
          direccion: cliente.direccion,
        },
        createdAt: admin.firestore.Timestamp.now(),
      };
  
      const docRef = await db.collection("Quotations").add(newQuotation);
  
      res.status(200).json({
        success: true,
        message: "Cotización guardada exitosamente.",
        id: docRef.id,
      });
    } catch (error) {
      console.error("Error al guardar la cotización:", error);
      res.status(500).json({
        success: false,
        error: "Error al guardar la cotización.",
      });
    }
  });
  
app.get("/get-quotations", async (req, res) => {
try {
    const quotationsSnapshot = await db.collection("Quotations").orderBy("createdAt", "desc").get();

    const quotations = quotationsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    }));

    res.status(200).json({
    success: true,
    quotations,
    });
} catch (error) {
    console.error("Error al obtener las cotizaciones:", error);
    res.status(500).json({
    success: false,
    error: "Error al obtener las cotizaciones.",
    });
}
});

app.put("/update-quotation/:id", async (req, res) => {
    const { id } = req.params; // Obtén el ID de la cotización desde los parámetros de la URL
    const updatedData = req.body; // Datos actualizados enviados desde el cliente
  
    try {
      // Verifica si el ID existe
      const docRef = db.collection("Quotations").doc(id);
      const doc = await docRef.get();
  
      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          error: "La cotización con el ID proporcionado no existe.",
        });
      }

      if (!updatedData.tipoPlan || !updatedData.cliente || !updatedData.user) {
        return res.status(400).json({
          success: false,
          error: "Faltan datos requeridos (tipoPlan, cliente o user).",
        });
      }
      
  
      // Actualiza la cotización en Firestore
      await docRef.update({
        ...updatedData,
        updatedAt: admin.firestore.Timestamp.now(), // Agrega un campo con la fecha de la última actualización
      });
  
      res.status(200).json({
        success: true,
        message: "Cotización actualizada exitosamente.",
      });
    } catch (error) {
      console.error("Error al actualizar la cotización:", error);
      res.status(500).json({
        success: false,
        error: "Error al actualizar la cotización.",
      });
    }
  });
  
app.delete("/delete-quotation/:id", async (req, res) => {
const { id } = req.params;

try {
    await db.collection("Quotations").doc(id).delete();
    res.status(200).json({ success: true, message: "Cotización eliminada exitosamente." });
} catch (error) {
    console.error("Error al eliminar la cotización:", error);
    res.status(500).json({ success: false, error: "Error al eliminar la cotización." });
}
});

app.get("/get-users", async (req, res) => {
    try {
      const usersSnapshot = await db.collection("Users").get();
  
      const users = usersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
  
      res.status(200).json({ success: true, users });
    } catch (error) {
      console.error("Error al obtener usuarios:", error);
      res.status(500).json({ success: false, error: "Error al obtener usuarios." });
    }
  });
   
app.post("/change-password", async (req, res) => {
    const { email, newPassword } = req.body;
  
    if (!email || !newPassword) {
      return res.status(400).json({ error: "Email y nueva contraseña son requeridos." });
    }
  
    try {
      const userRef = db.collection("Users").where("email", "==", email);
      const snapshot = await userRef.get();
  
      if (snapshot.empty) {
        return res.status(404).json({ error: "Usuario no encontrado." });
      }
  
      const userDoc = snapshot.docs[0];
      await userDoc.ref.update({ password: newPassword });
  
      res.status(200).json({ success: true, message: "Contraseña actualizada exitosamente." });
    } catch (error) {
      console.error("Error al cambiar la contraseña:", error);
      res.status(500).json({ error: "Error al cambiar la contraseña." });
    }
  });
 
app.post("/add-user", async (req, res) => {
const { email, role, fullName } = req.body;

if (!email || !role || !fullName) {
    return res.status(400).json({ error: "Email, role y fullName son requeridos." });
}

try {
    // Verificar si el usuario ya existe
    const userSnapshot = await db.collection("Users").where("email", "==", email).get();

    if (!userSnapshot.empty) {
    return res.status(400).json({ error: "El usuario con este email ya existe." });
    }

    // Crear el nuevo usuario
    const newUser = {
    email,
    role,
    fullName, // Agregar el campo fullName al usuario
    password: "1234", // Puedes establecer una contraseña predeterminada
    };

    await db.collection("Users").add(newUser);

    res.status(200).json({ success: true, message: "Usuario agregado exitosamente." });
} catch (error) {
    console.error("Error al agregar usuario:", error);
    res.status(500).json({ error: "Error al agregar el usuario." });
}
});
  
app.post("/reset-password", async (req, res) => {
    const { email } = req.body;
  
    if (!email) {
      return res.status(400).json({ error: "El email del usuario es obligatorio." });
    }
  
    try {
      const usersCollection = db.collection("Users");
      const userSnapshot = await usersCollection.where("email", "==", email).get();
  
      if (userSnapshot.empty) {
        return res.status(404).json({ error: "Usuario no encontrado." });
      }
  
      const userDoc = userSnapshot.docs[0];
      await userDoc.ref.update({ password: "1234" });
  
      res.status(200).json({ message: "Contraseña restablecida exitosamente a '1234'." });
    } catch (error) {
      console.error("Error al restablecer la contraseña:", error);
      res.status(500).json({ error: "Error interno del servidor." });
    }
  });

app.post("/delete-user", async (req, res) => {
const { email } = req.body;

if (!email) {
    return res.status(400).json({ error: "El email es requerido para eliminar un usuario." });
}

try {
    // Buscar el usuario por email
    const userSnapshot = await db.collection("Users").where("email", "==", email).get();

    if (userSnapshot.empty) {
    return res.status(404).json({ error: "Usuario no encontrado." });
    }

    // Eliminar el usuario encontrado
    const batch = db.batch(); // Para manejar múltiples documentos si es necesario
    userSnapshot.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    res.status(200).json({ success: true, message: "Usuario eliminado exitosamente." });
} catch (error) {
    console.error("Error al eliminar usuario:", error);
    res.status(500).json({ error: "Error al eliminar el usuario." });
}
});
  
  
  
  


// Iniciar servidor
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});

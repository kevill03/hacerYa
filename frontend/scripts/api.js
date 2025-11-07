const PROD_API_URL = "https://hacerya.onrender.com/api";
const DEV_API_URL = "http://localhost:3000/api";

const BASE_API_URL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? DEV_API_URL
    : PROD_API_URL;

const getToken = () => localStorage.getItem("token");

export const apiRequest = async (endpoint, method = "GET", body = null) => {
  const token = getToken();
  if (!token && method !== "GET") {
    console.error("Token no encontrado para solicitud autenticada.");
    throw new Error("Autenticación requerida.");
  }

  const options = {
    method: method,
    headers: {},
  };

  if (token) {
    options.headers["Authorization"] = `Bearer ${token}`;
  }

  if (body) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${BASE_API_URL}${endpoint}`, options);

    if (response.status === 204) {
      return { data: { success: true }, status: response.status };
    }

    const contentType = response.headers.get("content-type");
    let data;
    if (contentType && contentType.indexOf("application/json") !== -1) {
      data = await response.json();
    } else {
      if (!response.ok) {
        throw new Error(
          `Error ${response.status}: Respuesta inesperada del servidor.`
        );
      }
      return { success: true, status: response.status };
    }

    if (!response.ok) {
      throw new Error(
        data.message ||
          data.error ||
          `Error ${response.status}: Fallo en la API.`
      );
    }
    return { data, status: response.status };
  } catch (error) {
    console.error(`Error en API ${method} ${endpoint}:`, error);
    throw error;
  }
};

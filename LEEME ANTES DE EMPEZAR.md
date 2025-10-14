**HacerYA WebApp**



Aplicación web desarrollada como primer entregable del Módulo 1, enfocada en la gestión de autenticación con niveles de usuario y una interfaz dinámica según el rol (administrador o usuario).

El proyecto integra frontend y backend, haciendo uso de Node.js, Express y PostgreSQL como principales tecnologías.



**Alcance del Primer Entregable**



El alcance actual incluye:



Una landing page (index.html) funcional que contiene enlaces operativos a redes sociales y un botón de Inicio de Sesión.



Al presionar dicho botón, se redirige al fichero login.html, donde el usuario puede iniciar sesión.



El sistema distingue roles de usuario:



Administrador: accede a un panel (workspaceFront.html) con un sidebar que contiene tres opciones (incluyendo Estadísticas y Reportes).



Usuario: accede al mismo panel, pero con solo dos opciones visibles, ya que no debe tener acceso a la sección de Estadísticas y Reportes.



La autenticación y control de roles funcionan correctamente mediante la comunicación entre el frontend y el backend.



Las contraseñas no están encriptadas, dado que para el primer entregable no es un requisito.

Las credenciales serán suministradas dentro del presente archivo al final del mismo



**Tecnologías Utilizadas**



Node.js (v16+ recomendado)



Express.js



PostgreSQL



HTML5, CSS3 y JavaScript (Frontend puro)



JWT (para validación de roles y autenticación)



dotenv, bcrypt, cors



Live Server (VSCode) para ejecutar el frontend



**Instalación y Configuración**



&nbsp;Instalar dependencias del backend



Desde la carpeta backend:



npm init -y

npm install express pg bcrypt jsonwebtoken dotenv cors

npm install --save-dev nodemon



  **Configurar variables de entorno**



Crea un archivo llamado .env dentro de la carpeta backend con la siguiente estructura:



DATABASE\_URL=postgresql://mi\_usuario:mi\_password@localhost:5432/hacerya\_db

PORT=3000

JWT\_SECRET=EstaEsMiClaveSecretaParaElModulo1



&nbsp;Asegúrate de cambiar mi\_usuario y mi\_password por tus credenciales reales de PostgreSQL.



**Restaurar la Base de Datos**



El archivo hacerya\_db.sql contiene la estructura necesaria para ejecutar el sistema.

Debe restaurarse desde pgAdmin

1\.  Abra su herramienta de administración de PostgreSQL

2\.  \*\*Cree una nueva base de datos vacía\*\* con el nombre `hacerya\_db`.

3\.  Restaure el archivo `hacerya\_db\_dump.sql` sobre esta base de datos.

\*(Se recomienda usar \*\*PostgreSQL versión 18\*\* o superior, que es la versión utilizada en el desarrollo.)\*





**Ejecución del Proyecto**

Paso 1: Iniciar el backend



Dentro de la carpeta backend:



npm start



Paso 2: Iniciar el frontend



Abrir el archivo index.html mediante Live Server en VSCode.

Esto es obligatorio, ya que el frontend realiza solicitudes al servidor y no funcionará correctamente si solo se abre el archivo directamente desde el navegador.







**Requisitos Previos**



Node.js (v16 o superior)



PostgreSQL (v18 recomendado)



Visual Studio Code (u otro editor)



Extensión Live Server instalada



**Recomendaciones**



Verificar que tanto el backend (servidor Express) como el frontend (Live Server) estén corriendo simultáneamente.



En futuras versiones se añadirá encriptación de contraseñas y persistencia de sesión.





**Credenciales de Prueba**



Estas credenciales están disponibles para el primer entregable, dado que no se aplica encriptación de contraseñas aún:



Rol administrador:

admin@prueba.com

Admin1234





Rol Usuario Final:

usuario@prueba.com

Usuario1234




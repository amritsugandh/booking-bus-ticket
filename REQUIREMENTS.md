# Project Requirements & Technology Stack

This document outlines the core programming languages, runtime environments, databases, and exact package dependencies utilized in the Bus Ticket Booking System.

## 1. Core Languages
- **HTML:** HTML5 (Used for semantic structure, input validation, and layout)
- **CSS:** Vanilla CSS3 (Utilized for the advanced "Glassmorphism" UI, responsive Flexbox/Grid layouts, and micro-animations. No external frameworks like Bootstrap were used to maintain maximum control).
- **JavaScript:** ECMAScript 2015 / ES6+ (Used for frontend dynamic DOM manipulation, Fetch API integration, and backend Node.js logic).

## 2. Server Environment & Backend
- **Runtime Environment:** Node.js (Recommended version: v18.0.0 or higher)
- **Backend Framework:** Express.js (v4.18.2)

## 3. Database
- **Database Engine:** SQLite3 (v5.1.7)
- **Data Storage:** Local relational database (`busticket.db`)

## 4. Required Package Dependencies (npm)
The project relies on specific Node packages. These are strictly required to run the backend server safely and correctly:
- **`express` (v4.18.2):** Web framework used to handle backend routing and API endpoints.
- **`sqlite3` (v5.1.7):** Asynchronous database bindings allowing Node.js to interact with the SQLite database.
- **`bcryptjs` (v2.4.3):** Cryptography library used to securely hash encryption strings and salt user passwords before storing them in the database.
- **`jsonwebtoken` (v9.0.2):** Security library used to generate and verify JWT tokens for stateless user and admin authentication flows.
- **`cors` (v2.8.6):** Middleware to enable Cross-Origin Resource Sharing on the server.

## 5. Running the Project
To install all required dependencies and run the project locally, execute the following commands in your terminal at the project root:

```bash
# Install dependencies
npm install

# Start the server
npm start
```

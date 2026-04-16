# 🚌 Bus Ticket Booking System

A full-stack, production-grade Bus Ticket Booking application with user and admin dashboards. This system allows users to search for buses, book tickets, select specific seats, and generate digital boarding passes, while providing administrators with tools to manage fleets, routes, schedules, and view total revenue.

## ✨ Features

### User Features
- **User Authentication:** Secure login and registration using JWT and bcrypt.
- **Dynamic Bus Search:** Filter buses by origin, destination, and date.
- **Interactive Seat Selection:** Visual interface to pick from available seats before booking.
- **E-Tickets & QR Codes:** Professional digital tickets displaying journey details and a realistic QR-code for boarding.
- **User Dashboard:** Dedicated personalized dashboard to track upcoming, past, and canceled bookings.

### Admin Features
- **Fleet Management:** Add, edit, or delete buses from the system.
- **Schedule Management:** Update schedules, routes, and dynamically calculate total revenues based on bookings.
- **Admin Dashboard:** A modern, glassmorphism-styled dashboard for complete real-time oversight of the platform.

## 🛠️ Tech Stack
- **Frontend:** Vanilla HTML, CSS, JavaScript (Tailored Custom UI/UX, Glassmorphism & Responsive Design)
- **Backend:** Node.js, Express.js
- **Database:** SQLite (Stored locally as `busticket.db` for simple setup)
- **Authentication:** JSON Web Tokens (JWT)

## 🚀 How to Run Locally

To run this project on your local machine for evaluation:

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your computer.

### Installation Steps

1. **Clone the repository** (if you haven't already):
   ```bash
   git clone https://github.com/amritsugandh/booking-bus-ticket.git
   cd booking-bus-ticket
   ```

2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Open the Application:**
   Open your browser and navigate to exactly:
   ```
   http://localhost:3000/modern_ui/index.html
   ```

*(Note: The `busticket.db` database is already included in the repository and contains prepopulated sample data, meaning the system is ready to test immediately).*

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Survey from './pages/Survey';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import RecordingIndicators from './pages/RecordingIndicators';
import ExacerbationForecast from './pages/ExacerbationForecast';
import GraphsOfChanges from './pages/GraphsOfChanges';
import MedicationDiary from './pages/MedicationDiary';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/survey" element={<Survey />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/recording-indicators" element={<RecordingIndicators />} />
        <Route path="/exacerbation-forecast" element={<ExacerbationForecast />} />
        <Route path="/graphs-of-changes" element={<GraphsOfChanges />} />
        <Route path="/medication-diary" element={<MedicationDiary />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;

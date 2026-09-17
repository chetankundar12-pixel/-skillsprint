// Top Indian universities (non-IIT) + a starter list of Mumbai University
// affiliated engineering colleges. Extend this list as needed — for any
// university other than Mumbai University, the signup form falls back to
// a free-text college name field.

module.exports = {
  universities: [
    "University of Mumbai",
    "University of Delhi",
    "Savitribai Phule Pune University",
    "Anna University",
    "Visvesvaraya Technological University (VTU)",
    "Jadavpur University",
    "Osmania University",
    "Jawaharlal Nehru Technological University (JNTU)",
    "Amity University",
    "Chandigarh University",
    "Gujarat Technological University (GTU)",
    "Rashtrasant Tukadoji Maharaj Nagpur University",
    "Other"
  ],
  collegesByUniversity: {
    "University of Mumbai": [
      "A.C. Patil College of Engineering",
      "Fr. Conceicao Rodrigues College of Engineering",
      "K. J. Somaiya College of Engineering",
      "Sardar Patel Institute of Technology",
      "Thadomal Shahani Engineering College",
      "Vidyalankar Institute of Technology",
      "Atharva College of Engineering",
      "Xavier Institute of Engineering",
      "Vivekanand Education Society's Institute of Technology",
      "Other"
    ]
  },
  years: ["First Year", "Second Year", "Third Year", "Final Year"],
  streams: [
    "Computer Engineering",
    "Information Technology",
    "Electronics and Telecommunication",
    "Mechanical Engineering",
    "Civil Engineering",
    "Electrical Engineering"
  ]
};

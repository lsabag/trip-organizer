INSERT OR IGNORE INTO trips (id, name, date, time, meeting, description, image, hidden, status, creator_token, participants, waypoints)
VALUES (
  't1',
  'שמורת עין גדי',
  '2025-04-18',
  '07:30',
  'צומת מחלף גהה',
  'נחל דוד ועין גדי. כובע ומים חובה! רמת קושי: קלה-בינונית.',
  'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80',
  0,
  'open',
  'system',
  '[{"id":"p1","name":"דניאל לוי","phone":"054-1234567","city":"תל אביב","hasCar":true,"seats":3,"carFrom":"תל אביב","carTo":"תל אביב","carNotes":"יוצא ב-7:00 בדיוק","needRide":false,"assignedTo":null,"notes":""},{"id":"p2","name":"מיכל כהן","phone":"052-9876543","city":"רמת גן","hasCar":false,"seats":0,"carFrom":"","carTo":"","carNotes":"","needRide":true,"assignedTo":null,"notes":"אלרגית לאבקנים"},{"id":"p3","name":"יוסי ברק","phone":"050-1112233","city":"פתח תקווה","hasCar":false,"seats":0,"carFrom":"","carTo":"","carNotes":"","needRide":true,"assignedTo":null,"notes":""},{"id":"p4","name":"שרה מזרחי","phone":"053-4445566","city":"גבעתיים","hasCar":true,"seats":2,"carFrom":"גבעתיים","carTo":"גבעתיים","carNotes":"","needRide":false,"assignedTo":null,"notes":""}]',
  '[{"id":"w1","name":"כניסת הפארק – עין גדי","address":"Ein Gedi Nature Reserve, Israel","phone":"08-6584285","time":"09:00","notes":"חנייה חינמית. יש לרכוש כרטיסים בכניסה.","lat":31.4627,"lng":35.3827,"rating":null,"ratingsTotal":null,"placeId":null},{"id":"w2","name":"מפל דוד","address":"David Waterfall Ein Gedi","phone":"","time":"10:00","notes":"עליה של כ-30 דק מהכניסה.","lat":31.4656,"lng":35.3889,"rating":null,"ratingsTotal":null,"placeId":null},{"id":"w3","name":"בריכת השולמית","address":"Shulamit Spring Ein Gedi Israel","phone":"","time":"11:30","notes":"הנקודה הגבוהה של המסלול. נוף מדהים.","lat":31.4681,"lng":35.3912,"rating":null,"ratingsTotal":null,"placeId":null},{"id":"w4","name":"חוף עין גדי – ים המלח","address":"Ein Gedi Beach Dead Sea Israel","phone":"08-6591591","time":"14:00","notes":"מקלחות חיצוניות, שמן רחיצה מומלץ.","lat":31.452,"lng":35.3763,"rating":null,"ratingsTotal":null,"placeId":null}]'
);

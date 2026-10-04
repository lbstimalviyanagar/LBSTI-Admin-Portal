<?php
error_reporting(E_ALL);
ini_set("display_errors", 1);
require 'config.php';

$csvData = <<<CSV
Student,Course,Phone,Source,Status,Counselor,Follow-up,Created,Locality,Preferred Batch,Remarks
Rahul Robert,ADCA (12 Months),8700988483,Walkin,New,Harjot,0,03/Aug/26,E93 upper ground floor khirki village malviya nagar,,
Uma,DAFA (6 Months),8527243723,Refrence,New,Harjot,0,03/Aug/26,Begampur,,
Priya,DAFA (6 Months),9711769678,Refrence,New,Harjot,0,03/Aug/26,Begampur,,
Mohd. Mohsin,English Speaking Course (6 Months),9910941624,Walkin,No Response,Harjot,01/Aug/26,04/Aug/26,Hauz rani,,
Khushi,DIT (12 Months),8826097298,Google,No Response,Sahil,0,06/Aug/26,Begampur,,
Rahul kumar,English Speaking Course (6 Months),7042814360,Walkin,Confirmed,Sahil,0,06/Aug/26,3A/1 Toot Sarai malviya nagar,,
Rahul kumar,English Speaking Course (6 Months),7042814360,Walkin,Counseling done,Sahil,0,06/Aug/26,3A/1 Toot Sarai malviya nagar,,
Kartik,DDM (6 Months),8376845860,Walkin,Counseling done,Harjot,31/Aug/26,07/Aug/26,Nil 78A malviya nagar,,Will confirm Today (Fee discount required)
Mohd Miraj,CCO (3 Months),6205473595,Refrence,No Response,Sahil,22/Aug/26,10/Aug/26,Malviya Nagar,Evening (4 PM - 8 PM),Will join soon
Amir,ADCA (12 Months),9266567447,Refrence,New,Harjot,0,10/Aug/26,Begampur,,
Akshath Rawat,DADA (6 Months),9971845005,Walkin,Confirmed,Sahil,11/Aug/26,11/Aug/26,Khirki extension,Afternoon (12 PM - 4 PM),
Roshini,Tally Prime (2 Months),7428515403,Google,No Response,Sahil,01/Sept/26,12/Aug/26,Malviya Nagar,Afternoon (12 PM - 4 PM),Councelling done for esc and tally 13320 in two installments
Sunita,DDM (6 Months),8700669659,Refrence,No Response,Sahil,01/Sept/26,12/Aug/26,Khirki,Afternoon (12 PM - 4 PM),Form filled
Jarina,ADCA (12 Months),9546036576,Refrence,Counseling done,Sahil,31/Aug/26,12/Aug/26,Hauzrani,Evening (4 PM - 8 PM),She is coming today
Ashish,ADCA (12 Months),9599411203,Refrence,Confirmed,Sahil,0,12/Aug/26,Shahpur Jatt,Morning (8 AM - 12 PM),
Rajeev,English Speaking Course (6 Months),9871888825,Walkin,No Response,Sahil,01/Sept/26,12/Aug/26,Malviya Nagar,Evening (4 PM - 8 PM),Will confirm soon
Rayaan,CCO (3 Months),9871115216,Refrence,No Response,Sahil,01/Sept/26,12/Aug/26,Hauzrani,Evening (4 PM - 8 PM),Will confirm soon
Urvi,DAFA (6 Months),8527964293,Google,Dropped,Harjot,0,12/Aug/26,Malviya nagar,,Not required for now.
Jarina,ADCA (12 Months),9546036576,Refrence,Dropped,Sahil,31/Aug/26,12/Aug/26,Hauzrani,Evening (4 PM - 8 PM),she is not attending calls for a long time
Lalit,ADCA (12 Months),8287201501,Refrence,New,Sahil,31/Aug/26,13/Aug/26,Hauzrani,Afternoon (12 PM - 4 PM),Callback again (outside)
Aarav,English Speaking Course (6 Months),8077139567,Google,Confirmed,Sahil,14/Aug/26,13/Aug/26,Tyagi Raj Nagar,Afternoon (12 PM - 4 PM),
Aarav,English Speaking Course (6 Months),8077139567,Google,Counseling done,Sahil,14/Aug/26,13/Aug/26,Tyagi Raj Nagar,Afternoon (12 PM - 4 PM),
Komal,DABC (12 Months),8178723338,Google,No Response,Sahil,01/Sept/26,14/Aug/26,East Delhi,,Looking for beautician in east Delhi
Sandeep,English Speaking Course (6 Months),6396809929,Refrence,Counseling Scheduled,Sahil,31/Aug/26,14/Aug/26,Khirki extension,Morning (8 AM - 12 PM),Coming today
Abdul Hamza,ADCA (12 Months),8860104853,Walkin,No Response,Sahil,01/Sept/26,14/Aug/26,Hauzrani,Afternoon (12 PM - 4 PM),Will confirm soon
Sandeev,English Speaking Course (6 Months),6396809929,Refrence,Confirmed,Sahil,31/Aug/26,14/Aug/26,Khirki extension,Morning (8 AM - 12 PM),Coming today
Sana,ADCA (12 Months),9311345422,Refrence,Counseling Scheduled,Sahil,31/Aug/26,17/Aug/26,Malviya nagar,Afternoon (12 PM - 4 PM),Visiting by eod
Shradha,NTC (12 Months),9354990541,Google,No Response,Sahil,01/Sept/26,18/Aug/26,Malviya Nagar,Afternoon (12 PM - 4 PM),Demo class
Kanha,Advance Excel (2 Months),7248358861,Refrence,Counseling Scheduled,Harjot,31/Aug/26,19/Aug/26,Begampur,,Will come by EOD
Aashish,Advance Excel (2 Months),6380619135,Refrence,Counseling Scheduled,Harjot,31/Aug/26,19/Aug/26,Begampur,,Kanha will come
Meghansh,Advance Excel (2 Months),8619220368,Refrence,Counseling Scheduled,Harjot,31/Aug/26,19/Aug/26,Begampur,,Kanha
Kanha,Advance Excel (2 Months),7248358861,Refrence,Confirmed,Harjot,31/Aug/26,19/Aug/26,Begampur,,Will come by EOD
Biljit Kaur,NTC (12 Months),9910299296,Google,Counseling Scheduled,Sahil,01/Sept/26,21/Aug/26,Panscheel,Afternoon (12 PM - 4 PM),Coming by 1st sep
Vidhi,DBC (6 Months),8527145962,Walkin,New,Harjot,0,21/Aug/26,Rajeev gandhi colony okhla,,
Biljit Kaur,NTC (12 Months),9910299296,Google,Dropped,Sahil,01/Sept/26,21/Aug/26,Panscheel,Afternoon (12 PM - 4 PM),Coming by 1st sep
Udal Ahirwal,DGD (6 Months),8810374353,Google,New,Sahil,29/Aug/26,27/Aug/26,Hauzrani,Morning (8 AM - 12 PM),
Laxmi,ADCA (12 Months),8826404398,Walkin,New,Sahil,29/Aug/26,27/Aug/26,Malviya Nagar,Evening (4 PM - 8 PM),
Kritika,DEA (12 Months),7982643700,Google,New,Sahil,0,29/Aug/26,RK puram,Evening (4 PM - 8 PM),Monday
Sahil,ADCA (12 Months),8796830841,Walkin,Confirmed,Sahil,0,29/Aug/26,Hauzrani,Evening (4 PM - 8 PM),
Mahi,CCO (3 Months),9717868891,Walkin,New,Sahil,31/Aug/26,29/Aug/26,Begampur,Afternoon (12 PM - 4 PM),
Amisha,English Speaking Course (6 Months),9773566196,Walkin,No Response,Sahil,31/Aug/26,29/Aug/26,Begampur,Afternoon (12 PM - 4 PM),
Sarabjit Singh,English Speaking Course (6 Months),7827462003,Walkin,Counseling Scheduled,Sahil,31/Aug/26,31/Aug/26,Malviya Nagar,Afternoon (12 PM - 4 PM),Today by 12 Pm
Sarabjit Singh,English Speaking Course (6 Months),7827462003,Walkin,New,Sahil,31/Aug/26,31/Aug/26,Malviya Nagar,Afternoon (12 PM - 4 PM),He will come today for the admission
Aasiya Mansuri,English Speaking Course (6 Months),9899093422,Walkin,Confirmed,Sahil,31/Aug/26,31/Aug/26,Hauzrani,Evening (4 PM - 8 PM),English and computer both
Preetam,ADCA (12 Months),8954644256,Walkin,Counseling done,Sahil,19/Sept/26,31/Aug/26,Shivalik,Morning (8 AM - 12 PM),Will join (visited multiple times) / CNR
Farhan,English Speaking Course (6 Months),8796132045,Refrence,Confirmed,Sahil,01/Sept/26,01/Sept/26,Hauzrani,,
Uvesh Ali,English Speaking Course (6 Months),7827529805,Refrence,New,Sahil,01/Sept/26,01/Sept/26,Hauzrani,Evening (4 PM - 8 PM),
Dev Prakash,CCO (3 Months),9953072615,Refrence,Confirmed,Sahil,02/Sept/26,01/Sept/26,Malviya Nagar,Morning (8 AM - 12 PM),
Rashmi Surin,CCO (3 Months),8826917630,Walkin,Confirmed,Sahil,01/Sept/26,01/Sept/26,Geetanjali Enclave,Afternoon (12 PM - 4 PM),
Bhavya,ADCA (12 Months),9821170958,Walkin,New,Harjot,19/Sept/26,03/Sept/26,Malviya nagar,,Cnr
Asha,ADCA (12 Months),9315907880,Walkin,New,Harjot,0,03/Sept/26,Malviya nagar,,
Bhupender,ADCA (12 Months),9318316448,Walkin,New,Harjot,0,03/Sept/26,Malviya nagar,,
Iqra,ADCA (12 Months),8882082453,Walkin,Confirmed,Harjot,0,03/Sept/26,Malviya nagar,,
Testing,DEA (12 Months),6205473590,Google,Counseling done,Sahil,05/Sept/26,04/Sept/26,Malviya Nagar,Evening (4 PM - 8 PM),Coming by 5 pm
Testing,DEA (12 Months),6205473590,Google,Counseling done,Sahil,05/Sept/26,04/Sept/26,Malviya Nagar,Evening (4 PM - 8 PM),Coming by 5 pm
Testing,DEA (12 Months),6205473590,Google,Dropped,Sahil,05/Sept/26,04/Sept/26,Malviya Nagar,Evening (4 PM - 8 PM),Coming by 5 pm
Khushboo,DABC (12 Months),8383046696,Social Media,New,Sahil,05/Sept/26,05/Sept/26,Hauzrani,Morning (8 AM - 12 PM),She wants to join for Esc as well
Madina,CCO (3 Months),9319016141,Walkin,Counseling Scheduled,Sahil,06/Sept/26,05/Sept/26,Malviya Nagar,Morning (8 AM - 12 PM),She can visit on Sunday
Vicky,English Speaking Course (6 Months),9717262977,Walkin,Dropped,Sahil,07/Sept/26,05/Sept/26,Malviya Nagar,Morning (8 AM - 12 PM),Need confirmation for spanish in morning
Umey kulsum,English Speaking Course (6 Months),8287414678,Refrence,New,Sahil,09/Sept/26,08/Sept/26,Haurani,Evening (4 PM - 8 PM),
Gopal,Premiere Pro (1 Month),9800359318,Refrence,Counseling done,Sahil,09/Sept/26,09/Sept/26,Hauzrani,Evening (4 PM - 8 PM),Visiting Today by 8 pm
Rachi,ADCA (12 Months),8871403898,Google,New,Sahil,18/Sept/26,09/Sept/26,Palam Raj Nagar,,
Sachin,DDM (6 Months),8743859186,Google,New,Sahil,0,09/Sept/26,Vasant Kunj,,
Pushpeder Sharma,DMM (12 Months),6389553144,Google,New,Sahil,18/Sept/26,09/Sept/26,Rajeev Nagar,,DGD
Deepa,DAFA (6 Months),9717280685,Social Media,New,Sahil,14/Sept/26,14/Sept/26,Begampur,Evening (4 PM - 8 PM),
Virat,ADCA (12 Months),8826996633,Google,Counseling Scheduled,Sahil,16/Sept/26,14/Sept/26,Khirki,Evening (4 PM - 8 PM),She will visit by 15th sep with his son/ Whatsapp not available
Vipin,DDM (6 Months),9654519669,Walkin,Confirmed,Sahil,15/Sept/26,15/Sept/26,Malviya Nagar,,Visit today
Manish,CCO (3 Months),8105025511,Social Media,New,Sahil,17/Sept/26,16/Sept/26,Malviya Nagar,Evening (4 PM - 8 PM),
Raj Singh,IT (Not Confirmed),7042078292,Google,Counseling Scheduled,Sahil,17/Sept/26,16/Sept/26,Malviya Nagar,Evening (4 PM - 8 PM),Looking for his children's 12th and Graduated
Aslam,CCO (3 Months),9560527228,Google,New,Sahil,17/Sept/26,16/Sept/26,Malviya Nagar,,Looking for his Daughter in 12th
Shakeel Ahmad,NPTC (24 Months),8527360130,Google,New,Sahil,17/Sept/26,16/Sept/26,Malviya Nagar,Evening (4 PM - 8 PM),
Khushi,IT (Not Confirmed),9310986041,Social Media,Dropped,Sahil,05/Sept/26,17/Sept/26,Malviya Nagar,Morning (8 AM - 12 PM),He is looking for Spanish
Aftab Ali,DAFA (6 Months),8368383695,Refrence,New,Sahil,0,17/Sept/26,Begam Pur,,
Satyam Kuwar,DEA (12 Months),9266375634,Refrence,New,Sahil,0,17/Sept/26,Malviya Nagar,,
Tannu,DGD (6 Months),9315371634,Google,New,Sahil,0,17/Sept/26,Savitri Nagar,,DABC
Gaurav Prakash Arya,DADA (6 Months),9891626245,Google,New,Sahil,0,17/Sept/26,Sangam Vihar,,
Jyoti,DDM (6 Months),9811965611,Google,New,Sahil,0,17/Sept/26,Savitri Nagar,,
Arshi khan,CCO (3 Months),9811328035,Walkin,Counseling done,Sahil,18/Sept/26,17/Sept/26,Hauzrani,Morning (8 AM - 12 PM),
Anurag,DADA (6 Months),9220561804,Walkin,Counseling done,Sahil,18/Sept/26,17/Sept/26,Malviya Nagar,,
Priya,IT (Not Confirmed),9354040560,Walkin,Counseling done,Sahil,18/Sept/26,17/Sept/26,Malviya Nagar,Morning (8 AM - 12 PM),
Amit,Premiere Pro (1 Month),8700240098,Google,New,Sahil,0,18/Sept/26,Malviya Nagar,,
Ankit,DEA (12 Months),7289944760,Google,Confirmed,Sahil,0,18/Sept/26,"JH,124,Ground Floor Near Krishna",,
Yuvika,ADCA (12 Months),9310517320,Google,New,Sahil,0,18/Sept/26,Gupta Colony,,
Kashish,DEA (12 Months),9289821413,Google,New,Sahil,0,18/Sept/26,Malviya Nagar,,
Rahima,English Speaking Course (6 Months),9354185575,Google,New,Sahil,0,18/Sept/26,Malviya Nagar,,
Nazia,ADCA (12 Months),9205049531,Google,New,Sahil,0,18/Sept/26,Khirki Extension,,
Rajan,IT (Not Confirmed),7562847281,Google,New,Sahil,0,18/Sept/26,Begampur,Morning (8 AM - 12 PM),She will confirm about
Rejeev,English Speaking Course (6 Months),7042233741,Google,Counseling Scheduled,Sahil,18/Sept/26,18/Sept/26,Panchsheel,,Scheduled for 5 Pm today
Zoya,ADCA (12 Months),9220802417,Walkin,New,Sahil,19/Sept/26,18/Sept/26,Begampur,Morning (8 AM - 12 PM),
Komal,DEA (12 Months),8218373152,Google,Counseling done,Harjot,21/Sept/26,19/Sept/26,Malviya Nagar,Morning (8 AM - 12 PM),
Neha / Laxmi,IT (Not Confirmed),9717277156,Walkin,Counseling Scheduled,Sahil,21/Sept/26,19/Sept/26,Khirki extension,,
Shivam,ADCA (12 Months),9479890062,Google,Counseling Scheduled,Sahil,22/Sept/26,20/Sept/26,Malviya Nagar,Evening (4 PM - 8 PM),He wants to learn graphics and basics
Ashish,CCO (3 Months),9205875869,Google,New,Sahil,21/Sept/26,21/Sept/26,Pansheel,Afternoon (12 PM - 4 PM),
Roshini,IT (Not Confirmed),9058456699,Google,New,Sahil,22/Sept/26,21/Sept/26,Pansheel,,
SONI,DBC (6 Months),9810174756,Google,Counseling done,Sahil,22/Sept/26,21/Sept/26,Malviya Nagar,Morning (8 AM - 12 PM),SHE WILL LEARN SELF CUSOMIZED COURSE FOR 3 MONTHS
Anshika,IT (Not Confirmed),9315353280,Google,Counseling Scheduled,Sahil,21/Sept/26,21/Sept/26,Malviya Nagar,Afternoon (12 PM - 4 PM),
Harpal,IT (Not Confirmed),9810372866,Walkin,Counseling done,Sahil,23/Sept/26,21/Sept/26,Malviya Nagar,Afternoon (12 PM - 4 PM),AI-11 — AI Graphic Designing
Fardeen,Advance Excel (2 Months),7838852093,Google,Confirmed,Sahil,21/Sept/26,21/Sept/26,Hauzrani,Morning (8 AM - 12 PM),
Barkha,IT (Not Confirmed),7011010721,Google,Counseling done,Sahil,23/Sept/26,22/Sept/26,Begampur,,She wants to join for AI Fundamental course
BABY,Beautician (1/3 Months),7303343527,Walkin,Confirmed,Ali Sir,22/Sept/26,22/Sept/26,Begampur,,"addmission in 2 days, will come with perants, 20% in monthly installment / one time"
SABA,NPTC (24 Months),9266160258,Walkin,Confirmed,Ali Sir,22/Sept/26,22/Sept/26,Malviya Nagar,,will take addmission in 2 days also 20% discount in one time payment. but no discount in monthly fee
Azra,NPTC (24 Months),8810688612,Walkin,Confirmed,Ali Sir,22/Sept/26,22/Sept/26,Malviya Nagar,,"add in 2 days, 20% discount in one time payment. no discount in monthly fee."
Shivam,English Typing (1/3 Months),8755533120,Google,Confirmed,Sahil,24/Sept/26,23/Sept/26,Begampur,Afternoon (12 PM - 4 PM),He wants to do in 2 months
Aarifa,ADCA (12 Months),9999367885,Google,Counseling Scheduled,Sahil,24/Sept/26,23/Sept/26,Savitri Nagar,,He will come in the evening
Geeta Tamang,IT (Not Confirmed),9650514962,Google,Counseling Scheduled,Sahil,24/Sept/26,23/Sept/26,Hauz Khas,,She will come soon
Ravneet,DABC (12 Months),9768877817,Google,Counseling Scheduled,Sahil,24/Sept/26,23/Sept/26,Malviya Nagar,,She will confirm after discussion with her sis
Vivek,DADA (6 Months),9074113396,Google,Counseling Scheduled,Sahil,24/Sept/26,23/Sept/26,Malviya Nagar,Afternoon (12 PM - 4 PM),He is having bank exp and coming by tom for councelling
Yatharth,Full Stack Developer (8 Months),9149152376,Google,Counseling Scheduled,Sahil,25/Sept/26,24/Sept/26,Malviya Nagar,,He will visit tomorrow
Abhinav,English Speaking Course (6 Months),9289123476,Google,Counseling Scheduled,Sahil,25/Sept/26,24/Sept/26,Malviya Nagar,Evening (4 PM - 8 PM),His mother will come in the evening and she will also join for AI and CCO
Mahi,English Speaking Course (6 Months),9717075852,Google,Counseling Scheduled,Sahil,25/Sept/26,24/Sept/26,Pansheel,Evening (4 PM - 8 PM),
Shreya Gupta,DADA (6 Months),7779862403,Google,Confirmed,Sahil,26/Sept/26,24/Sept/26,Malviya Nagar,,She took the form with her.
Jyoti,ADCA (12 Months),9990332860,Refrence,Counseling done,Sahil,29/Sept/26,28/Sept/26,Hauzrani,Evening (4 PM - 8 PM),She is will confirm soon for joining the class
Vaibhav,DADTP (6 Months),8923346934,Google,Confirmed,Sahil,28/Sept/26,28/Sept/26,Begampur,Afternoon (12 PM - 4 PM),He want I year diploma for desktop publishing.
kashish,English Speaking Course (6 Months),7303774701,Google,New,Sahil,29/Sept/26,29/Sept/26,Shiv Vihar,Evening (4 PM - 8 PM),She will confirm soon and she need 6pm batch
Dhruv,DADA (6 Months),9953735753,Google,Counseling Scheduled,Sahil,30/Sept/26,30/Sept/26,Malviya Nagar,,Coming by 8 pm today for admission
Aman Ansari,DADA (6 Months),8595216059,Google,Counseling done,Sahil,01/Oct/26,01/Oct/26,Hauzrani,Evening (4 PM - 8 PM),He will join by the evening.
CSV;

$lines = explode("\n", trim($csvData));
$headers = str_getcsv(array_shift($lines));

$nameIdx = array_search('Student', $headers);
$phoneIdx = array_search('Phone', $headers);
$courseIdx = array_search('Course', $headers);
$sourceIdx = array_search('Source', $headers);
$statusIdx = array_search('Status', $headers);
$counselorIdx = array_search('Counselor', $headers);
$localityIdx = array_search('Locality', $headers);
$batchIdx = array_search('Preferred Batch', $headers);
$remarksIdx = array_search('Remarks', $headers);
$followupIdx = array_search('Follow-up', $headers);
$createdIdx = array_search('Created', $headers);

$successCount = 0;
$skipCount = 0;

$checkStmt = $pdo->prepare("SELECT id FROM enquiries WHERE phone = ?");
$insertStmt = $pdo->prepare("INSERT INTO enquiries (name, phone, email, city, course, batch, source, status, assigned_to, follow_up_date, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

foreach ($lines as $line) {
    if (!trim($line)) continue;
    $row = str_getcsv($line);
    
    $name = trim($row[$nameIdx] ?? '');
    $phone = trim($row[$phoneIdx] ?? '');
    
    if (!$name || !$phone) {
        $skipCount++;
        continue;
    }

    $checkStmt->execute([$phone]);
    if ($checkStmt->fetch()) {
        $skipCount++;
        continue;
    }

    $now = date('Y-m-d H:i:s');
    $createdAt = $now;
    
    $createdStr = trim($row[$createdIdx] ?? '');
    if ($createdStr) {
        $parsed = date_create_from_format('d/M/y', $createdStr);
        if ($parsed) {
            $createdAt = $parsed->format('Y-m-d H:i:s');
        }
    }

    $followUpDate = null;
    $followupStr = trim($row[$followupIdx] ?? '');
    if ($followupStr && $followupStr !== '0') {
        $parsed = date_create_from_format('d/M/y', $followupStr);
        if ($parsed) {
            $followUpDate = $parsed->format('Y-m-d');
        }
    }

    $insertStmt->execute([
        $name, 
        $phone, 
        '', // email
        trim($row[$localityIdx] ?? ''), 
        trim($row[$courseIdx] ?? ''),
        trim($row[$batchIdx] ?? ''), 
        trim($row[$sourceIdx] ?? ''), 
        trim($row[$statusIdx] ?? 'New'),
        trim($row[$counselorIdx] ?? ''), 
        $followUpDate,
        trim($row[$remarksIdx] ?? ''),
        $createdAt, 
        $createdAt
    ]);
    $successCount++;
}

echo "<h1>CSV Import Completed</h1>";
echo "<p>Successfully imported <strong>$successCount</strong> leads.</p>";
echo "<p>Skipped <strong>$skipCount</strong> duplicates/invalid leads.</p>";
echo "<p>You can now delete this script file (import_data.php).</p>";
?>

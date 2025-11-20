Main is being used to create the SQLITE db for both secure/insecure branches along with having the same .gitignore for both branches.

The steps below are for both branches, to see the difference in secure and insecure.

1:
Insecure;
    SQL InjectionLogin 
    Email: ' OR id=6-- →  You Password: anything , you will land on the admin dashboard.

Secure;
    Repeat the steps on secure branch, will recieve invalid login.

2:
Insecure;
    Reflected XSS 
    Go to URL: http://localhost:3000/search?q=<script>alert(1)</script>, alert popup appears
 Secure;   
    Same URL, "cannot GET /search"

3:
Insecure;
    Stored XSS 
    1. Login as normal user (test1@example.com // pass123)
    2. Add task → Title: <script>alert('STORED')</script>
    3. Submit
    Alert appears on every page refresh
Secure:
    Same exact steps (test4@example.com // pass123)
    Task saved, but no alert, shows as plain text

4:
Insecure;
    DOM-Based XSS 
    While logged in → URL: http://localhost:3000/dashboard?inject=<img src=x onerror=alert('DOM')>
    Alert popup
Secure;
    Same URL
    No alert (script escaped) / nothing happens

5: 
Insecure
    Sensitive Data Exposure 
    1. Login as admin (admin@taskvault.com / Admin123!) or use same as step 1
    2. Click “Admin Panel”
    Table shows Password column with plaintext passwords
Secure;    
    Same steps (admin2@taskvault.com / Admin123!)
    Table shows only ID, Name, Email with no password column

6:
Insecure;
    Register → Redirect 
    Register any user after submit, Redirects to login page
Secure;  
    Same steps, Redirects to login page (with CSRF token)

7:
Insecure;
    Login page http://localhost:3000  
    Simple form, no CSRF token
Secure;
    Same steps
    Form contains hidden CSRF field
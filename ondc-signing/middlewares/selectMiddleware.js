import dotenv from 'dotenv';

dotenv.config();

export default function selectMiddleware(req, res, next) {
    console.log("Middleware triggered for /select");
    try {
        const authCookie = req.cookies;
        console.log("Cookies:", authCookie);
    
        // Extract api_token from cookies
        const apiToken = authCookie?.api_token;
        
        // Check if .env has necessary credentials
        const hasCredentials = process.env.OPENCART_USERNAME && process.env.OPENCART_KEY;
    
        // Validation logic
        const isValidRequest = !!(apiToken && hasCredentials);
    
        req.isValidRequest = isValidRequest;
    
        if (isValidRequest) {
          console.log('✅ Valid request. Proceeding...');
        } else {
          console.warn('❌ Invalid request. Missing Opencart token or env credentials.');
        }
    
        next();
        
      } catch (error) {
        console.error("Middleware Error:", error);
        return res.status(500).json({ error: "An error occurred in middleware." });
      }
}

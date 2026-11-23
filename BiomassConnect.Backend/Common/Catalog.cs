namespace BiomassConnect.Backend.Common;

/// <summary>Fixed option lists copied from the frontend forms.</summary>
public static class Catalog
{
    // js/farmer/farmer-utils.js
    public static readonly string[] BiomassTypes =
    [
        "Rice Husk", "Rice Straw", "Wheat Straw", "Sugarcane Bagasse", "Cotton Stalk",
        "Soybean Husk", "Corn Cob", "Maize Stover", "Groundnut Shell", "Mustard Stalk", "Coconut Husk"
    ];

    // js/farmer/farmer-utils.js (the registration form offers a subset of these)
    public static readonly string[] IndianStates =
    [
        "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
        "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
        "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
        "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
        "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
        "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
    ];

    // manufacturer/pellet-listing.html
    public static readonly string[] PelletTypes =
    [
        "Agro Residue Pellets", "Rice Husk Pellets", "Bagasse Pellets", "Wheat Straw Pellets",
        "Mustard Husk Pellets", "Groundnut Shell Pellets", "Wood Pellets", "Mixed Biomass Pellets"
    ];

    public static readonly string[] Grades = ["Premium", "Standard", "Industrial"];

    // auth/register.html
    public static readonly string[] SecurityQuestions =
    [
        "What is your first school name?", "What is your favourite color?",
        "What is your birth city?", "What is your mother's maiden name?"
    ];

    // farmer/profile.html
    public static readonly string[] Genders = ["Male", "Female", "Other"];

    // js/common/store.js COMPLAINT_CATEGORIES
    public static readonly string[] FarmerComplaintCategories =
        ["Payment not received", "Payment delayed", "Wrong amount paid", "Partial payment received"];
    public static readonly string[] ManufacturerComplaintCategories =
        ["Payment not received", "Payment delayed", "Wrong amount paid", "Biomass quality issue", "Quantity mismatch", "Other"];
    public static readonly string[] PowerPlantComplaintCategories =
        ["Pellet quality issue", "Quantity mismatch", "Billing issue", "Other"];

    // admin/user-management.html
    public static readonly string[] BlockCategories =
    [
        "Fraudulent activity", "Fake or misleading listings", "Payment default",
        "Orders not supplied", "Abusive behaviour", "Other policy violation"
    ];

    // admin/*-verification.html
    public static readonly string[] RejectCategories = ["Document unclear", "Details mismatch", "Invalid document", "Other"];

    // index.html contact form
    public static readonly string[] ContactRoles = ["Farmer", "Manufacturer", "Coal Power Plant", "Other"];

    // js/powerplant/plant.js
    public const decimal Co2PerTon = 1.5m;       // t CO2 avoided per t pellets co-fired
    public const decimal CoalPerTon = 1.15m;     // t coal displaced per t pellets
    public const decimal StubblePerTon = 1.2m;   // t crop residue kept from open burning per t pellets
    public const decimal Co2PerTree = 0.022m;    // t CO2 absorbed by one tree per year

    // powerplant/consumption.html
    public const decimal MaxCofiringRatioPct = 20m;
    public const decimal MaxDailyEnergyMwh = 100000m;

    public const string CertificateTitle = "Government Norms Compliance Certificate";
}

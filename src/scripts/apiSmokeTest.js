require("dotenv").config();

const base = (process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}/api`).replace(/\/$/, "");
const userId = process.env.TEST_ADMIN_USER_ID || process.env.SEED_ADMIN_USER_ID || "admin";
const password = process.env.TEST_ADMIN_PASSWORD || process.env.SEED_ADMIN_PASSWORD || "ChangeMe@123";
const runPdfTest = String(process.env.TEST_PDF || "false").toLowerCase() === "true";

let token = "";
let stepNo = 0;
const ids = {};

async function request(method, path, body, expected = [200]) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.arrayBuffer();
  if (!expected.includes(response.status)) {
    const text = data instanceof ArrayBuffer ? `<${data.byteLength} bytes>` : JSON.stringify(data);
    throw new Error(`${method} ${path} -> ${response.status}. Expected ${expected.join("/")}. ${text}`);
  }
  return { response, data };
}

async function step(name, fn) {
  stepNo += 1;
  process.stdout.write(`[API-TEST ${String(stepNo).padStart(2, "0")}] ${name} ... `);
  const result = await fn();
  console.log("PASS");
  return result;
}

async function main() {
  const suffix = `${Date.now()}`.slice(-8);

  await step("API health", async () => {
    const { data } = await request("GET", "/health");
    if (!data.success) throw new Error("health returned success=false");
  });

  await step("MongoDB health", async () => {
    const { data } = await request("GET", "/health/db");
    if (!data.success || data.database !== "connected") throw new Error("database health failed");
  });

  await step("Login", async () => {
    const { data } = await request("POST", "/auth/login", { userId, password });
    token = data.token;
    if (!token) throw new Error("login did not return a token");
  });

  await step("Authenticated /me", async () => {
    const { data } = await request("GET", "/auth/me");
    if (!data.user?.id) throw new Error("/me did not return user");
  });

  const address = {
    line1: "Block No. 02, Sadafulli, Rana Nagar",
    city: "Chhatrapati Sambhajinagar",
    state: "Maharashtra",
    stateCode: "27",
    pincode: "431005",
    country: "India"
  };

  await step("Create Company Master", async () => {
    const { data } = await request("POST", "/companies", {
      companyName: `ThetaVega Test ${suffix}`,
      companyCode: `TVT${suffix}`,
      gstin: `27AAICT${suffix.slice(-4)}A1Z${Number(suffix.slice(-1)) % 9}`.slice(0, 15),
      pan: `AAICT${suffix.slice(-4)}A`,
      cin: "U72900PN2020PTC193900",
      stateCode: "27",
      gstState: "Maharashtra",
      registeredAddress: address,
      email: `test-${suffix}@thetavega.tech`,
      authorizedSignatoryText: "AUTHORISED SIGNATORY"
    }, [201]);
    ids.companyId = data.data._id;
  });

  await step("Create Cost Center Master", async () => {
    const { data } = await request("POST", "/cost-centers", {
      costCenterCode: `CC${suffix}`,
      costCenterName: `Test Cost Center ${suffix}`,
      type: "Manufacturing"
    }, [201]);
    ids.costCenterId = data.data._id;
  });

  await step("Create Project Master", async () => {
    const { data } = await request("POST", "/projects", {
      projectCode: `C${suffix}`,
      customerName: "Test Customer",
      projectName: `Test PO Project ${suffix}`,
      application: "LASER MARKING MACHINE FOR DIE CASTED COMPONENTS",
      projectDocumentNo: "PROJECT PO TEST"
    }, [201]);
    ids.projectId = data.data._id;
  });

  await step("Create Vendor Master", async () => {
    const { data } = await request("POST", "/vendors", {
      vendorCode: `V${suffix}`,
      vendorName: `Test Vendor ${suffix}`,
      purchaseType: "Domestic",
      registeredAddress: { ...address, state: "Karnataka", stateCode: "29", city: "Bengaluru", pincode: "560094" },
      gstNo: "29AAACI8711P1Z1",
      panNo: "AAACI8711P",
      currency: "INR",
      contacts: [{ type: "Sales", name: "Test Contact", phone: "9999999999", email: `vendor-${suffix}@example.com` }]
    }, [201]);
    ids.vendorId = data.data._id;
  });

  await step("Create Delivery Address Master", async () => {
    const { data } = await request("POST", "/delivery-addresses", {
      deliveryCode: `DEL${suffix}`,
      name: `Test Stores ${suffix}`,
      registeredAddress: address,
      storeContactNo: "9999999999",
      storePersonName: "Test Store Person",
      email: `stores-${suffix}@thetavega.tech`
    }, [201]);
    ids.deliveryAddressId = data.data._id;
  });

  await step("Create Material Master", async () => {
    const { data } = await request("POST", "/materials", {
      itemCode: `MAT${suffix}`,
      description: "YLP 30W FIBER LASER SOURCE YLP 30V2 series",
      uom: "Set",
      itemType: "Goods",
      hsnSacCode: "8456",
      gstPercent: 0
    }, [201]);
    ids.materialId = data.data._id;
  });

  await step("Reject invalid PO quantity", async () => {
    await request("POST", "/purchase-orders", {
      companyId: ids.companyId,
      vendorId: ids.vendorId,
      costCenterId: ids.costCenterId,
      projectId: ids.projectId,
      deliveryAddressId: ids.deliveryAddressId,
      poType: "Project",
      poDate: new Date().toISOString(),
      header: { paymentSummary: "100 % AGAINST PI" },
      items: [{ materialId: ids.materialId, qty: 0, rate: 337000 }]
    }, [400]);
  });

  await step("Create Purchase Order", async () => {
    const { data } = await request("POST", "/purchase-orders", {
      companyId: ids.companyId,
      vendorId: ids.vendorId,
      costCenterId: ids.costCenterId,
      projectId: ids.projectId,
      deliveryAddressId: ids.deliveryAddressId,
      poType: "Project",
      poDate: new Date().toISOString(),
      header: {
        documentType: "Email Quote",
        paymentSummary: "100 % AGAINST PI",
        buyerName: "API Test Buyer",
        taxesDutiesText: "EXTRA AT ACTUAL"
      },
      items: [{ materialId: ids.materialId, qty: 6, rate: 337000 }],
      charges: { packingMode: "At Actual", freightMode: "At Actual" }
    }, [201]);
    ids.poId = data.data._id;
    if (data.data.totals?.grandTotal !== 2022000) throw new Error("PO total did not equal 2,022,000");
    if (data.data.status !== "Draft") throw new Error("New PO is not Draft");
  });

  await step("Read Purchase Order", async () => {
    const { data } = await request("GET", `/purchase-orders/${ids.poId}`);
    if (data.data._id !== ids.poId) throw new Error("PO read mismatch");
  });

  await step("List/filter Purchase Orders", async () => {
    const { data } = await request("GET", `/purchase-orders?status=Draft&vendorId=${ids.vendorId}`);
    if (!data.data.some((x) => x._id === ids.poId)) throw new Error("Created PO not found in list");
  });

  if (runPdfTest) {
    await step("Draft PDF preview", async () => {
      const { response, data } = await request("GET", `/purchase-orders/${ids.poId}/pdf?preview=true`);
      if (!response.headers.get("content-type")?.includes("application/pdf")) throw new Error("Preview is not PDF");
      if (!(data instanceof ArrayBuffer) || data.byteLength < 1000) throw new Error("Preview PDF looks empty");
    });
  }

  if (String(process.env.PO_APPROVAL_REQUIRED || "true").toLowerCase() !== "false") {
    await step("Submit PO", async () => {
      const { data } = await request("POST", `/purchase-orders/${ids.poId}/submit`, { comment: "API smoke test" });
      if (data.data.status !== "Pending Approval") throw new Error("Submit status mismatch");
    });

    await step("Approve PO", async () => {
      const { data } = await request("POST", `/purchase-orders/${ids.poId}/approve`, { comment: "Approved by API test" });
      if (data.data.status !== "Approved") throw new Error("Approval status mismatch");
    });
  }

  await step("Issue PO", async () => {
    const { data } = await request("POST", `/purchase-orders/${ids.poId}/issue`, {});
    if (data.data.status !== "Issued") throw new Error("Issue status mismatch");
  });

  if (runPdfTest) {
    await step("Official PDF", async () => {
      const { response, data } = await request("GET", `/purchase-orders/${ids.poId}/pdf`);
      if (!response.headers.get("content-type")?.includes("application/pdf")) throw new Error("Official output is not PDF");
      if (!(data instanceof ArrayBuffer) || data.byteLength < 1000) throw new Error("Official PDF looks empty");
    });
  }

  await step("Audit log", async () => {
    const { data } = await request("GET", `/purchase-orders/${ids.poId}/audit`);
    const actions = data.data.map((x) => x.action);
    for (const required of ["CREATED", "ISSUED"]) {
      if (!actions.includes(required)) throw new Error(`Missing audit action ${required}`);
    }
  });

  await step("PO report", async () => {
    const { data } = await request("GET", `/reports/purchase-orders?vendorId=${ids.vendorId}`);
    if (!data.data.some((x) => x._id === ids.poId)) throw new Error("PO missing from report");
  });

  console.log(`\n[API-TEST] PASS - ${stepNo} checks completed.`);
  console.log(`[API-TEST] Test PO id: ${ids.poId}`);
  console.log("[API-TEST] Test master records are intentionally retained for inspection. Run this only on a development/test database.");
}

main().catch((error) => {
  console.error(`\n[API-TEST] FAIL - ${error.message}`);
  process.exit(1);
});

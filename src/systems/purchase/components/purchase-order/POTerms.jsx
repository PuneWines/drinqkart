import React from "react";

const POTerms = ({ vendorTerms, companyTerms, terms, defaultTerms }) => {
  const rawTerms = vendorTerms ?? companyTerms ?? terms ?? defaultTerms;

  let termsList = [];
  if (Array.isArray(rawTerms)) {
    termsList = rawTerms;
  } else if (typeof rawTerms === "string" && rawTerms.trim() !== "") {
    termsList = rawTerms.split("\n").map((t) => t.trim()).filter(Boolean);
  }

  if (!termsList || termsList.length === 0) return null;

  return (
    <div className="po-terms-block">
      <h4>Terms and conditions:</h4>
      <ol>
        {termsList.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ol>
    </div>
  );
};

export default POTerms;

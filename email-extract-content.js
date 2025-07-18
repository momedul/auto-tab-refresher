(async function() {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  let allEmails = new Set();

  function extractEmailsFromText(text) {
    const matches = text.match(emailRegex);
    if (matches) {
      matches.forEach(email => allEmails.add(email));
    }
  }

  function crawlDocument(doc) {
    // Extract from body text
    extractEmailsFromText(doc.body.innerText);

    // Extract from attributes (e.g., mailto links, data attributes)
    const elements = doc.querySelectorAll('*');
    elements.forEach(el => {
      // Check for mailto links
      if (el.tagName === 'A' && el.href.startsWith('mailto:')) {
        const email = el.href.split(':')[1].split('?')[0]; // Get email before any query params
        if (emailRegex.test(email)) { // Validate it's a valid email format
            allEmails.add(email);
        }
      }
      // Check all attributes for email patterns
      for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes[i];
        extractEmailsFromText(attr.value);
      }
    });
  }

  // First, extract from the main document
  crawlDocument(document);

  // Then, extract from iframes
  const iframes = document.querySelectorAll('iframe');
  for (const iframe of iframes) {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      if (iframeDoc) {
        crawlDocument(iframeDoc);
      }
    } catch (e) {
      // Cross-origin iframes will throw a SecurityError
      // console.warn("Could not access iframe content due to same-origin policy:", iframe.src, e);
      // For cross-origin iframes, we can't directly access their content due to security policies.
      // A more complex solution involving message passing to a service worker and then
      // executing a content script in the iframe's context (if possible and permitted by the iframe's CSP)
      // would be needed, but it's generally not straightforward or always possible.
      // For the purpose of a simple extractor, we acknowledge this limitation.
    }
  }

  // Objects are often embedded like iframes or as plugins.
  // Direct content access to <object> elements is generally more restricted than iframes
  // especially for plugins (Flash, Java applets etc. which are largely deprecated).
  // For HTML content embedded via <object>, it behaves similar to iframe regarding contentDocument.
  const objects = document.querySelectorAll('object');
  for (const obj of objects) {
      try {
          const objectDoc = obj.contentDocument || obj.contentWindow.document;
          if (objectDoc) {
              crawlDocument(objectDoc);
          }
      } catch (e) {
          // Similar to iframes, cross-origin or plugin objects will throw errors.
          // console.warn("Could not access object content:", obj.data, e);
      }
  }


  // Return the unique emails to the popup script
  return Array.from(allEmails);
})();

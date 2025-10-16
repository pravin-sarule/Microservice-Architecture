

// import React, { useState } from 'react';
// import html2pdf from 'html2pdf.js';
// import { Download, Printer, Loader2 } from 'lucide-react';

// const DownloadPdf = ({ markdownOutputRef }) => {
//   const [isLoading, setIsLoading] = useState(false);
//   const [error, setError] = useState(null);
//   const [success, setSuccess] = useState(null);

//   // Function to remove specific lines from HTML content
//   const removeLinesFromHtml = (htmlString, linesToRemove) => {
//     let cleanedHtml = htmlString;
//     linesToRemove.forEach(line => {
//       // Use a regex to find and replace the line, handling potential leading/trailing whitespace and newlines
//       const regex = new RegExp(`\\s*${line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'g');
//       cleanedHtml = cleanedHtml.replace(regex, '');
//     });
//     return cleanedHtml;
//   };

//   const handleDownloadPdf = async () => {
//     const element = markdownOutputRef.current;
//     if (!element) {
//       setError('No content to download as PDF.');
//       return;
//     }

//     setIsLoading(true);
//     setError(null);
//     setSuccess(null);

//     try {
//       // Clone the element to avoid modifying the original
//       const clonedElement = element.cloneNode(true);
      
//       // Create a wrapper with proper styling
//       const wrapper = document.createElement('div');
//       wrapper.style.cssText = `
//         width: 800px;
//         padding: 40px;
//         background-color: #ffffff;
//         font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
//         color: #000000;
//         line-height: 1.6;
//       `;
      
//       // Apply styles to ensure tables render correctly
//       const styleElement = document.createElement('style');
//       styleElement.textContent = `
//         /* Tables */
//         table {
//           width: 100%;
//           border-collapse: collapse;
//           margin: 20px 0;
//           background-color: white;
//           page-break-inside: auto;
//         }
        
//         table tr {
//           page-break-inside: avoid;
//           page-break-after: auto;
//         }
        
//         thead {
//           display: table-header-group;
//           background-color: #f3f4f6 !important;
//         }
        
//         tbody {
//           display: table-row-group;
//         }
        
//         th {
//           background-color: #f3f4f6 !important;
//           color: #374151 !important;
//           font-weight: 600;
//           text-align: left;
//           padding: 12px 16px;
//           border: 1px solid #d1d5db !important;
//           font-size: 12px;
//           text-transform: uppercase;
//           letter-spacing: 0.5px;
//         }
        
//         td {
//           padding: 12px 16px;
//           border: 1px solid #d1d5db !important;
//           color: #1f2937 !important;
//           font-size: 14px;
//           background-color: white !important;
//         }
        
//         tr:hover td {
//           background-color: #f9fafb !important;
//         }
        
//         /* Headings */
//         h1 {
//           font-size: 24px;
//           font-weight: bold;
//           color: #111827;
//           margin: 24px 0 16px 0;
//           padding-bottom: 8px;
//           border-bottom: 2px solid #e5e7eb;
//         }
        
//         h2 {
//           font-size: 20px;
//           font-weight: bold;
//           color: #111827;
//           margin: 20px 0 12px 0;
//           padding-bottom: 6px;
//           border-bottom: 1px solid #e5e7eb;
//         }
        
//         h3 {
//           font-size: 18px;
//           font-weight: 600;
//           color: #1f2937;
//           margin: 16px 0 10px 0;
//         }
        
//         h4, h5, h6 {
//           font-size: 16px;
//           font-weight: 600;
//           color: #1f2937;
//           margin: 12px 0 8px 0;
//         }
        
//         /* Paragraphs */
//         p {
//           margin: 12px 0;
//           color: #1f2937;
//           font-size: 15px;
//           line-height: 1.7;
//         }
        
//         /* Lists */
//         ul, ol {
//           margin: 12px 0;
//           padding-left: 24px;
//           color: #1f2937;
//         }
        
//         li {
//           margin: 6px 0;
//           line-height: 1.6;
//         }
        
//         /* Code blocks */
//         pre {
//           background-color: #1f2937 !important;
//           color: #f9fafb !important;
//           padding: 16px;
//           border-radius: 6px;
//           overflow-x: auto;
//           margin: 16px 0;
//           font-family: 'Courier New', monospace;
//           font-size: 13px;
//           page-break-inside: avoid;
//         }
        
//         code {
//           background-color: #f3f4f6;
//           color: #dc2626;
//           padding: 2px 6px;
//           border-radius: 3px;
//           font-family: 'Courier New', monospace;
//           font-size: 13px;
//         }
        
//         pre code {
//           background-color: transparent;
//           color: #f9fafb;
//           padding: 0;
//         }
        
//         /* Blockquotes */
//         blockquote {
//           border-left: 4px solid #3b82f6;
//           padding: 12px 16px;
//           margin: 16px 0;
//           background-color: #eff6ff;
//           color: #1e40af;
//           font-style: italic;
//           border-radius: 0 6px 6px 0;
//         }
        
//         /* Links */
//         a {
//           color: #2563eb;
//           text-decoration: underline;
//           font-weight: 500;
//         }
        
//         /* Horizontal rules */
//         hr {
//           border: none;
//           border-top: 2px solid #e5e7eb;
//           margin: 24px 0;
//         }
        
//         /* Strong and emphasis */
//         strong, b {
//           font-weight: 700;
//           color: #111827;
//         }
        
//         em, i {
//           font-style: italic;
//           color: #1f2937;
//         }
        
//         /* Images */
//         img {
//           max-width: 100%;
//           height: auto;
//           border-radius: 8px;
//           margin: 16px 0;
//         }
        
//         /* Ensure content doesn't overflow */
//         * {
//           box-sizing: border-box;
//           max-width: 100%;
//         }
//       `;
      
//       wrapper.appendChild(styleElement);
//       wrapper.appendChild(clonedElement);
      
//       // Create a temporary container
//       const tempContainer = document.createElement('div');
//       tempContainer.style.position = 'absolute';
//       tempContainer.style.left = '-9999px';
//       tempContainer.style.top = '0';
//       tempContainer.appendChild(wrapper);
//       document.body.appendChild(tempContainer);

//       // Wait for any dynamic content to render
//       await new Promise(resolve => setTimeout(resolve, 100));

//       // Convert oklch colors to RGB before processing
//       const convertOklchToRgb = (doc) => {
//         const allElements = doc.querySelectorAll('*');
//         allElements.forEach(el => {
//           const styles = window.getComputedStyle(el);
          
//           // Convert background-color
//           if (styles.backgroundColor && styles.backgroundColor.includes('oklch')) {
//             el.style.backgroundColor = 'rgb(243, 244, 246)'; // fallback gray
//           }
          
//           // Convert color
//           if (styles.color && styles.color.includes('oklch')) {
//             el.style.color = 'rgb(31, 41, 55)'; // fallback dark gray
//           }
          
//           // Convert border-color
//           if (styles.borderColor && styles.borderColor.includes('oklch')) {
//             el.style.borderColor = 'rgb(209, 213, 219)'; // fallback gray
//           }
//         });
//       };

//       // Enhanced options for perfect quality
//       const opt = {
//         margin: [10, 10, 10, 10],
//         filename: `AI_Analysis_${new Date().toISOString().slice(0, 10)}_${Date.now()}.pdf`,
//         image: { 
//           type: 'jpeg', 
//           quality: 0.98 // Slightly reduce to prevent hang
//         },
//         html2canvas: { 
//           scale: 2, // Reduced from 3 to prevent hanging
//           useCORS: true,
//           allowTaint: true,
//           logging: false,
//           backgroundColor: '#ffffff',
//           windowWidth: 800,
//           letterRendering: true,
//           scrollY: 0,
//           scrollX: 0,
//           onclone: (clonedDoc) => {
//             const clonedContent = clonedDoc.querySelector('[style*="left: -9999px"]');
//             if (clonedContent) {
//               clonedContent.style.left = '0';
//               clonedContent.style.position = 'relative';
//               clonedContent.style.width = '800px';
//             }
            
//             // Convert oklch colors to RGB
//             convertOklchToRgb(clonedDoc);
            
//             // Force standard RGB colors for all elements
//             const allElements = clonedDoc.querySelectorAll('*');
//             allElements.forEach(el => {
//               const computedStyle = window.getComputedStyle(el);
              
//               // Remove any Tailwind/modern CSS that might cause issues
//               if (computedStyle.backgroundColor) {
//                 el.style.backgroundColor = computedStyle.backgroundColor;
//               }
//               if (computedStyle.color) {
//                 el.style.color = computedStyle.color;
//               }
//               if (computedStyle.borderColor) {
//                 el.style.borderColor = computedStyle.borderColor;
//               }
//             });
            
//             const tables = clonedDoc.querySelectorAll('table');
//             tables.forEach(table => {
//               table.style.borderCollapse = 'collapse';
//               table.style.width = '100%';
//               table.style.marginTop = '20px';
//               table.style.marginBottom = '20px';
//               table.style.backgroundColor = '#ffffff';
//             });
            
//             const cells = clonedDoc.querySelectorAll('th, td');
//             cells.forEach(cell => {
//               cell.style.border = '1px solid #d1d5db';
//               cell.style.padding = '12px 16px';
//               cell.style.backgroundColor = '#ffffff';
//             });
            
//             const headers = clonedDoc.querySelectorAll('th');
//             headers.forEach(th => {
//               th.style.backgroundColor = '#f3f4f6';
//               th.style.fontWeight = '600';
//               th.style.color = '#374151';
//             });
            
//             const tds = clonedDoc.querySelectorAll('td');
//             tds.forEach(td => {
//               td.style.color = '#1f2937';
//               td.style.backgroundColor = '#ffffff';
//             });
//           }
//         },
//         jsPDF: { 
//           unit: 'mm', 
//           format: 'a4', 
//           orientation: 'portrait',
//           compress: true
//         },
//         pagebreak: { 
//           mode: ['css', 'legacy'],
//           before: '.page-break-before',
//           after: '.page-break-after',
//           avoid: 'img'
//         }
//       };

//       await html2pdf().set(opt).from(wrapper).save();
      
//       document.body.removeChild(tempContainer);
      
//       setSuccess('PDF downloaded successfully!');
//       setTimeout(() => setSuccess(null), 3000);
//     } catch (err) {
//       console.error('Failed to generate PDF:', err);
//       setError(`Failed to download PDF: ${err.message}`);
//       setTimeout(() => setError(null), 5000);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const handlePrintPdf = () => {
//     const element = markdownOutputRef.current;
//     if (!element) {
//       setError('No content to print.');
//       setTimeout(() => setError(null), 5000);
//       return;
//     }

//     try {
//       const printWindow = window.open('', '_blank', 'width=800,height=600');
      
//       const htmlContent = `
//         <!DOCTYPE html>
//         <html>
//           <head>
//             <meta charset="UTF-8">
//             <title>AI Analysis Response - ${new Date().toLocaleDateString()}</title>
//             <style>
//               * {
//                 margin: 0;
//                 padding: 0;
//                 box-sizing: border-box;
//               }
              
//               body {
//                 font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
//                 padding: 20px;
//                 background: white;
//                 color: #000;
//                 line-height: 1.6;
//               }
              
//               @media print {
//                 @page {
//                   size: A4;
//                   margin: 2cm;
//                 }
                
//                 body {
//                   padding: 0;
//                 }
                
//                 h1, h2, h3, h4, h5, h6 {
//                   page-break-after: avoid;
//                   break-after: avoid;
//                 }
                
//                 table, pre, code, blockquote, img {
//                   page-break-inside: avoid;
//                   break-inside: avoid;
//                 }
                
//                 tr {
//                   page-break-inside: avoid;
//                   break-inside: avoid;
//                 }
//               }
              
//               table {
//                 width: 100%;
//                 border-collapse: collapse;
//                 margin: 20px 0;
//                 page-break-inside: auto;
//               }
              
//               thead {
//                 display: table-header-group;
//                 background-color: #f3f4f6;
//               }
              
//               th {
//                 background-color: #f3f4f6;
//                 color: #374151;
//                 font-weight: 600;
//                 text-align: left;
//                 padding: 12px 16px;
//                 border: 1px solid #d1d5db;
//                 font-size: 12px;
//                 text-transform: uppercase;
//               }
              
//               td {
//                 padding: 12px 16px;
//                 border: 1px solid #d1d5db;
//                 color: #1f2937;
//                 font-size: 14px;
//               }
              
//               tbody tr:nth-child(even) {
//                 background-color: #f9fafb;
//               }
              
//               h1 { font-size: 24px; font-weight: bold; margin: 24px 0 16px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
//               h2 { font-size: 20px; font-weight: bold; margin: 20px 0 12px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
//               h3 { font-size: 18px; font-weight: 600; margin: 16px 0 10px; }
//               p { margin: 12px 0; font-size: 15px; line-height: 1.7; }
//               ul, ol { margin: 12px 0; padding-left: 24px; }
//               li { margin: 6px 0; }
//               pre { background: #1f2937; color: #f9fafb; padding: 16px; border-radius: 6px; margin: 16px 0; overflow-x: auto; }
//               code { background: #f3f4f6; color: #dc2626; padding: 2px 6px; border-radius: 3px; font-size: 13px; }
//               pre code { background: transparent; color: #f9fafb; padding: 0; }
//               blockquote { border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0; background: #eff6ff; color: #1e40af; }
//               strong { font-weight: 700; }
//               a { color: #2563eb; text-decoration: underline; }
//               hr { border: none; border-top: 2px solid #e5e7eb; margin: 24px 0; }
//             </style>
//           </head>
//           <body>
//             ${element.innerHTML}
//             <script>
//               window.onload = function() {
//                 setTimeout(() => {
//                   window.print();
//                 }, 500);
//               };
//             </script>
//           </body>
//         </html>
//       `;

//       printWindow.document.write(htmlContent);
//       printWindow.document.close();
      
//       setSuccess('Print dialog opened!');
//       setTimeout(() => setSuccess(null), 3000);
//     } catch (err) {
//       console.error('Failed to open print dialog:', err);
//       setError(`Failed to open print dialog: ${err.message}`);
//       setTimeout(() => setError(null), 5000);
//     }
//   };

//   return (
//     <>
//       {/* Icon-only buttons */}
//       <button
//         onClick={handleDownloadPdf}
//         disabled={isLoading}
//         className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
//         title="Download as PDF"
//       >
//         {isLoading ? (
//           <Loader2 className="h-4 w-4 animate-spin" />
//         ) : (
//           <Download className="h-4 w-4" />
//         )}
//       </button>
      
//       <button
//         onClick={handlePrintPdf}
//         disabled={isLoading}
//         className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
//         title="Print to PDF (Best Quality)"
//       >
//         <Printer className="h-4 w-4" />
//       </button>

//       {/* Toast notifications */}
//       {error && (
//         <div className="fixed bottom-4 right-4 z-50 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg shadow-lg text-sm max-w-sm">
//           {error}
//         </div>
//       )}
      
//       {success && (
//         <div className="fixed bottom-4 right-4 z-50 bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg shadow-lg text-sm max-w-sm">
//           {success}
//         </div>
//       )}
//     </>
//   );
// };

// export default DownloadPdf;




import React, { useState } from 'react';
import html2pdf from 'html2pdf.js';
import { Download, Printer, Loader2 } from 'lucide-react';

const DownloadPdf = ({ markdownOutputRef }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Function to remove conversational text from LLM responses
  const removeConversationalText = (element) => {
    const conversationalPhrases = [
      /^Okay,.*?\.(\s|$)/i,
      /^Sure,.*?\.(\s|$)/i,
      /^Here'?s.*?\.(\s|$)/i,
      /^I'?ll.*?\.(\s|$)/i,
      /^Let me.*?\.(\s|$)/i,
      /^I'?ve.*?\.(\s|$)/i,
      /^Certainly.*?\.(\s|$)/i,
      /^Of course.*?\.(\s|$)/i,
      /^Absolutely.*?\.(\s|$)/i,
      /^Great,.*?\.(\s|$)/i,
      /^Perfect,.*?\.(\s|$)/i,
      /^Alright,.*?\.(\s|$)/i,
    ];

    // Get all text nodes
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }

    // Check first few text nodes for conversational phrases
    textNodes.slice(0, 3).forEach(textNode => {
      let text = textNode.textContent.trim();
      conversationalPhrases.forEach(phrase => {
        text = text.replace(phrase, '');
      });
      
      if (text !== textNode.textContent.trim()) {
        textNode.textContent = text;
        
        // If the parent paragraph is now empty, remove it
        const parent = textNode.parentElement;
        if (parent && parent.tagName === 'P' && parent.textContent.trim() === '') {
          parent.remove();
        }
      }
    });
  };

  const handleDownloadPdf = async () => {
    const element = markdownOutputRef.current;
    if (!element) {
      setError('No content to download as PDF.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Clone the element to avoid modifying the original
      const clonedElement = element.cloneNode(true);
      
      // Remove conversational text from the cloned element
      removeConversationalText(clonedElement);
      
      // Create a wrapper with proper styling
      const wrapper = document.createElement('div');
      wrapper.style.cssText = `
        width: 800px;
        padding: 40px;
        background-color: #ffffff;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        color: #000000;
        line-height: 1.6;
      `;
      
      // Apply styles to ensure tables render correctly
      const styleElement = document.createElement('style');
      styleElement.textContent = `
        /* Tables */
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
          background-color: white;
          page-break-inside: auto;
        }
        
        table tr {
          page-break-inside: avoid;
          page-break-after: auto;
        }
        
        thead {
          display: table-header-group;
          background-color: #f3f4f6 !important;
        }
        
        tbody {
          display: table-row-group;
        }
        
        th {
          background-color: #f3f4f6 !important;
          color: #374151 !important;
          font-weight: 600;
          text-align: left;
          padding: 12px 16px;
          border: 1px solid #d1d5db !important;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        td {
          padding: 12px 16px;
          border: 1px solid #d1d5db !important;
          color: #1f2937 !important;
          font-size: 14px;
          background-color: white !important;
        }
        
        tr:hover td {
          background-color: #f9fafb !important;
        }
        
        /* Headings */
        h1 {
          font-size: 24px;
          font-weight: bold;
          color: #111827;
          margin: 24px 0 16px 0;
          padding-bottom: 8px;
          border-bottom: 2px solid #e5e7eb;
        }
        
        h2 {
          font-size: 20px;
          font-weight: bold;
          color: #111827;
          margin: 20px 0 12px 0;
          padding-bottom: 6px;
          border-bottom: 1px solid #e5e7eb;
        }
        
        h3 {
          font-size: 18px;
          font-weight: 600;
          color: #1f2937;
          margin: 16px 0 10px 0;
        }
        
        h4, h5, h6 {
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
          margin: 12px 0 8px 0;
        }
        
        /* Paragraphs */
        p {
          margin: 12px 0;
          color: #1f2937;
          font-size: 15px;
          line-height: 1.7;
        }
        
        /* Lists */
        ul, ol {
          margin: 12px 0;
          padding-left: 24px;
          color: #1f2937;
        }
        
        li {
          margin: 6px 0;
          line-height: 1.6;
        }
        
        /* Code blocks */
        pre {
          background-color: #1f2937 !important;
          color: #f9fafb !important;
          padding: 16px;
          border-radius: 6px;
          overflow-x: auto;
          margin: 16px 0;
          font-family: 'Courier New', monospace;
          font-size: 13px;
          page-break-inside: avoid;
        }
        
        code {
          background-color: #f3f4f6;
          color: #dc2626;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: 'Courier New', monospace;
          font-size: 13px;
        }
        
        pre code {
          background-color: transparent;
          color: #f9fafb;
          padding: 0;
        }
        
        /* Blockquotes */
        blockquote {
          border-left: 4px solid #3b82f6;
          padding: 12px 16px;
          margin: 16px 0;
          background-color: #eff6ff;
          color: #1e40af;
          font-style: italic;
          border-radius: 0 6px 6px 0;
        }
        
        /* Links */
        a {
          color: #2563eb;
          text-decoration: underline;
          font-weight: 500;
        }
        
        /* Horizontal rules */
        hr {
          border: none;
          border-top: 2px solid #e5e7eb;
          margin: 24px 0;
        }
        
        /* Strong and emphasis */
        strong, b {
          font-weight: 700;
          color: #111827;
        }
        
        em, i {
          font-style: italic;
          color: #1f2937;
        }
        
        /* Images */
        img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          margin: 16px 0;
        }
        
        /* Ensure content doesn't overflow */
        * {
          box-sizing: border-box;
          max-width: 100%;
        }
      `;
      
      wrapper.appendChild(styleElement);
      wrapper.appendChild(clonedElement);
      
      // Create a temporary container
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '0';
      tempContainer.appendChild(wrapper);
      document.body.appendChild(tempContainer);

      // Wait for any dynamic content to render
      await new Promise(resolve => setTimeout(resolve, 100));

      // Convert oklch colors to RGB before processing
      const convertOklchToRgb = (doc) => {
        const allElements = doc.querySelectorAll('*');
        allElements.forEach(el => {
          const styles = window.getComputedStyle(el);
          
          // Convert background-color
          if (styles.backgroundColor && styles.backgroundColor.includes('oklch')) {
            el.style.backgroundColor = 'rgb(243, 244, 246)'; // fallback gray
          }
          
          // Convert color
          if (styles.color && styles.color.includes('oklch')) {
            el.style.color = 'rgb(31, 41, 55)'; // fallback dark gray
          }
          
          // Convert border-color
          if (styles.borderColor && styles.borderColor.includes('oklch')) {
            el.style.borderColor = 'rgb(209, 213, 219)'; // fallback gray
          }
        });
      };

      // Enhanced options for perfect quality
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `AI_Analysis_${new Date().toISOString().slice(0, 10)}_${Date.now()}.pdf`,
        image: { 
          type: 'jpeg', 
          quality: 0.98
        },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 800,
          letterRendering: true,
          scrollY: 0,
          scrollX: 0,
          onclone: (clonedDoc) => {
            const clonedContent = clonedDoc.querySelector('[style*="left: -9999px"]');
            if (clonedContent) {
              clonedContent.style.left = '0';
              clonedContent.style.position = 'relative';
              clonedContent.style.width = '800px';
            }
            
            // Convert oklch colors to RGB
            convertOklchToRgb(clonedDoc);
            
            // Force standard RGB colors for all elements
            const allElements = clonedDoc.querySelectorAll('*');
            allElements.forEach(el => {
              const computedStyle = window.getComputedStyle(el);
              
              // Remove any Tailwind/modern CSS that might cause issues
              if (computedStyle.backgroundColor) {
                el.style.backgroundColor = computedStyle.backgroundColor;
              }
              if (computedStyle.color) {
                el.style.color = computedStyle.color;
              }
              if (computedStyle.borderColor) {
                el.style.borderColor = computedStyle.borderColor;
              }
            });
            
            const tables = clonedDoc.querySelectorAll('table');
            tables.forEach(table => {
              table.style.borderCollapse = 'collapse';
              table.style.width = '100%';
              table.style.marginTop = '20px';
              table.style.marginBottom = '20px';
              table.style.backgroundColor = '#ffffff';
            });
            
            const cells = clonedDoc.querySelectorAll('th, td');
            cells.forEach(cell => {
              cell.style.border = '1px solid #d1d5db';
              cell.style.padding = '12px 16px';
              cell.style.backgroundColor = '#ffffff';
            });
            
            const headers = clonedDoc.querySelectorAll('th');
            headers.forEach(th => {
              th.style.backgroundColor = '#f3f4f6';
              th.style.fontWeight = '600';
              th.style.color = '#374151';
            });
            
            const tds = clonedDoc.querySelectorAll('td');
            tds.forEach(td => {
              td.style.color = '#1f2937';
              td.style.backgroundColor = '#ffffff';
            });
          }
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'portrait',
          compress: true
        },
        pagebreak: { 
          mode: ['css', 'legacy'],
          before: '.page-break-before',
          after: '.page-break-after',
          avoid: 'img'
        }
      };

      await html2pdf().set(opt).from(wrapper).save();
      
      document.body.removeChild(tempContainer);
      
      setSuccess('PDF downloaded successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      setError(`Failed to download PDF: ${err.message}`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrintPdf = () => {
    const element = markdownOutputRef.current;
    if (!element) {
      setError('No content to print.');
      setTimeout(() => setError(null), 5000);
      return;
    }

    try {
      // Clone and clean the content
      const clonedElement = element.cloneNode(true);
      removeConversationalText(clonedElement);
      
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>AI Analysis Response - ${new Date().toLocaleDateString()}</title>
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              
              body {
                font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                padding: 20px;
                background: white;
                color: #000;
                line-height: 1.6;
              }
              
              @media print {
                @page {
                  size: A4;
                  margin: 2cm;
                }
                
                body {
                  padding: 0;
                }
                
                h1, h2, h3, h4, h5, h6 {
                  page-break-after: avoid;
                  break-after: avoid;
                }
                
                table, pre, code, blockquote, img {
                  page-break-inside: avoid;
                  break-inside: avoid;
                }
                
                tr {
                  page-break-inside: avoid;
                  break-inside: avoid;
                }
              }
              
              table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
                page-break-inside: auto;
              }
              
              thead {
                display: table-header-group;
                background-color: #f3f4f6;
              }
              
              th {
                background-color: #f3f4f6;
                color: #374151;
                font-weight: 600;
                text-align: left;
                padding: 12px 16px;
                border: 1px solid #d1d5db;
                font-size: 12px;
                text-transform: uppercase;
              }
              
              td {
                padding: 12px 16px;
                border: 1px solid #d1d5db;
                color: #1f2937;
                font-size: 14px;
              }
              
              tbody tr:nth-child(even) {
                background-color: #f9fafb;
              }
              
              h1 { font-size: 24px; font-weight: bold; margin: 24px 0 16px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
              h2 { font-size: 20px; font-weight: bold; margin: 20px 0 12px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
              h3 { font-size: 18px; font-weight: 600; margin: 16px 0 10px; }
              p { margin: 12px 0; font-size: 15px; line-height: 1.7; }
              ul, ol { margin: 12px 0; padding-left: 24px; }
              li { margin: 6px 0; }
              pre { background: #1f2937; color: #f9fafb; padding: 16px; border-radius: 6px; margin: 16px 0; overflow-x: auto; }
              code { background: #f3f4f6; color: #dc2626; padding: 2px 6px; border-radius: 3px; font-size: 13px; }
              pre code { background: transparent; color: #f9fafb; padding: 0; }
              blockquote { border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0; background: #eff6ff; color: #1e40af; }
              strong { font-weight: 700; }
              a { color: #2563eb; text-decoration: underline; }
              hr { border: none; border-top: 2px solid #e5e7eb; margin: 24px 0; }
            </style>
          </head>
          <body>
            ${clonedElement.innerHTML}
            <script>
              window.onload = function() {
                setTimeout(() => {
                  window.print();
                }, 500);
              };
            </script>
          </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      setSuccess('Print dialog opened!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to open print dialog:', err);
      setError(`Failed to open print dialog: ${err.message}`);
      setTimeout(() => setError(null), 5000);
    }
  };

  return (
    <>
      {/* Icon-only buttons */}
      <button
        onClick={handleDownloadPdf}
        disabled={isLoading}
        className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Download as PDF"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
      </button>
      
      <button
        onClick={handlePrintPdf}
        disabled={isLoading}
        className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Print to PDF (Best Quality)"
      >
        <Printer className="h-4 w-4" />
      </button>

      {/* Toast notifications */}
      {error && (
        <div className="fixed bottom-4 right-4 z-50 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg shadow-lg text-sm max-w-sm">
          {error}
        </div>
      )}
      
      {success && (
        <div className="fixed bottom-4 right-4 z-50 bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg shadow-lg text-sm max-w-sm">
          {success}
        </div>
      )}
    </>
  );
};

export default DownloadPdf;
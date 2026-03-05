"use client";

import { useEffect, useState } from "react";
import { Award, Download } from "lucide-react";

interface Cert {
  id: string;
  verificationCode: string;
  issuedAt: string;
  courseTitle: string;
  courseCategory: string | null;
  bestScore: number | null;
  employeeName: string;
}

export default function MyCertificatesPage() {
  const [certificates, setCertificates] = useState<Cert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/employee/certificates")
      .then((r) => r.json())
      .then((data) => setCertificates(data.certificates))
      .finally(() => setLoading(false));
  }, []);

  const downloadPdf = async (cert: Cert) => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    doc.setFillColor(240, 245, 255);
    doc.rect(0, 0, 297, 210, "F");

    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(2);
    doc.rect(10, 10, 277, 190);
    doc.setLineWidth(0.5);
    doc.rect(14, 14, 269, 182);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(100, 116, 139);
    doc.text("ALMNFTHEN TRAINING MANAGEMENT SYSTEM", 148.5, 35, { align: "center" });

    doc.setFontSize(32);
    doc.setTextColor(30, 64, 175);
    doc.text("Certificate of Completion", 148.5, 60, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.setTextColor(71, 85, 105);
    doc.text("This certifies that", 148.5, 80, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(15, 23, 42);
    doc.text(cert.employeeName || "Employee", 148.5, 95, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.setTextColor(71, 85, 105);
    doc.text("has successfully completed the course", 148.5, 110, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(30, 64, 175);
    doc.text(cert.courseTitle, 148.5, 125, { align: "center" });

    if (cert.bestScore !== null) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.setTextColor(71, 85, 105);
      doc.text(`with a score of ${cert.bestScore}%`, 148.5, 138, { align: "center" });
    }

    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text(`Date: ${new Date(cert.issuedAt).toLocaleDateString()}`, 80, 165);
    doc.text(`Certificate ID: ${cert.verificationCode}`, 170, 165);

    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.5);
    doc.line(60, 170, 237, 170);

    doc.save(`${cert.courseTitle.replace(/\s+/g, "_")}_Certificate.pdf`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="page-header">My Certificates</h1>
          <p className="page-subheader">Download and share your training certificates</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="bg-card rounded-lg border h-64 animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">My Certificates</h1>
        <p className="page-subheader">Download and share your training certificates</p>
      </div>

      {certificates.length === 0 ? (
        <div className="bg-card rounded-lg border p-12 text-center">
          <Award className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No certificates yet. Complete a course to earn one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {certificates.map((cert) => (
            <div key={cert.id} className="bg-card rounded-lg border p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
                  <Award className="w-8 h-8 text-accent" />
                </div>
              </div>
              <h3 className="font-semibold text-foreground text-center mb-1">{cert.courseTitle}</h3>
              <p className="text-xs text-muted-foreground text-center mb-3">Completed on {new Date(cert.issuedAt).toLocaleDateString()}</p>
              <div className="space-y-2 text-sm">
                {cert.bestScore !== null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Score</span>
                    <span className="font-medium text-foreground">{cert.bestScore}%</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Certificate ID</span>
                  <span className="font-mono text-xs text-foreground">{cert.verificationCode}</span>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => downloadPdf(cert)}
                  className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Download PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

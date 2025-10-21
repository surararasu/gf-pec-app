import React from 'react';
// The 'jspdf' and 'jspdf-autotable' libraries are now loaded dynamically via a useEffect hook to prevent build errors.
import { FileDown, PlusCircle, Trash2, ArrowRight, ArrowLeft, Info, Loader, XCircle, User, Briefcase, Stethoscope, AlertTriangle, Users, ChevronDown, ChevronUp, ShieldCheck, TrendingUp, TrendingDown, Wallet } from './icons';

// --- App Configuration ---
const appConfig = {
    brandName: "XYZ Inc.",
    appTitle: "Good Faith Patient Estimate Calculator",
    appSubtitle: "An “A-grade” tool for accurately projecting patient financial responsibility with unparalleled precision and COB support."
};

// XYZ Inc. - A placeholder for a professional entity
const BrandHeader = ({ brandName }) => (
    <div className="flex items-center justify-center space-x-2 text-gray-500">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
        <span className="font-semibold text-lg">{brandName}</span>
    </div>
);

// --- Rounding Helper for Currency ---
const $ = (n) => Math.round((Number(n) || 0) * 100) / 100;

// --- Date Formatting Helper ---
const formatDate = (dateString) => {
    if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return 'N/A';
    }
    const [year, month, day] = dateString.split('-');
    // Handles timezone issue by creating date in UTC
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    // Use 'en-US' locale to ensure MM/DD/YYYY format
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
};


// --- MODIFIER LOGIC ---
const applyModifiers = (procedure) => {
    const originalAllowedAmount = Number(procedure.allowedAmount) || 0;
    let modifiedAllowedAmount = originalAllowedAmount;
    let modifierNote = null;
    const modifiers = procedure.modifiers ? procedure.modifiers.split(',').map(m => m.trim().toUpperCase()) : [];

    let noteParts = [];
    let factor = 1;
    if (modifiers.includes('50')) { factor *= 1.5; noteParts.push("+50% bilateral"); }
    if (modifiers.includes('62')) { factor *= 0.625; noteParts.push("Co-surgeon approximation @62.5%"); }
    // ... add other stacking modifiers here

    if (noteParts.length > 0) {
        modifiedAllowedAmount = $(originalAllowedAmount * factor);
        modifierNote = { description: "Pricing Modifiers Applied", patientOwes: 0.0, notes: `Factors: ${noteParts.join(', ')}.` };
    }

    return { modifiedAllowedAmount, modifierNote, originalAllowedAmount };
};

// --- Centralized Plan-Aware OOP Helper ---
const planAwareRemOop = (indOopMax, famOopMax, patientOopMet, familyOopMet, planType) => {
    const rInd = (indOopMax === '' || indOopMax == null) ? Infinity : Math.max(0, (Number(indOopMax) || 0) - (Number(patientOopMet) || 0));
    const rFam = (famOopMax === '' || famOopMax == null) ? Infinity : Math.max(0, (Number(famOopMax) || 0) - (Number(familyOopMet) || 0));
    if (planType === 'Individual') return rInd;
    if (planType === 'AggregateFamily') return rFam;
    return Math.min(rInd, rFam); // Embedded
};


// --- PROPENSITY TO PAY (PAYMENT READINESS) LOGIC ---
const calculatePropensityScore = (finalResponsibility, payers, propensityData) => {
    if (finalResponsibility <= 50) {
        return { score: 100, tier: 'High', recommendation: 'This balance is considered manageable. Standard payment options are likely suitable.' };
    }
    
    let score = 0;
    const factors = {};
    const primaryPayer = payers[0];

    // Factor 1: Estimate-to-Deductible Ratio (Weight: 30%)
    const indDed = Number(primaryPayer.benefits.individualDeductible) || 0;
    if (indDed > 0) {
        const ratio = Math.min(1, finalResponsibility / indDed); // Capped at 1
        factors.deductibleRatio = (1 - ratio) * 100;
    } else {
        factors.deductibleRatio = 100; // No deductible is a good sign
    }

    // Factor 2: Total Responsibility Amount (Weight: 25%)
    if (finalResponsibility < 250) factors.amount = 100;
    else if (finalResponsibility < 1000) factors.amount = 75;
    else if (finalResponsibility < 5000) factors.amount = 40;
    else factors.amount = 10;

    // Factor 3: Patient Payment History (Self-Reported) (Weight: 20%)
    switch (propensityData.paymentHistory) {
        case 'on_time': factors.history = 100; break;
        case 'payment_plan': factors.history = 80; break;
        case 'sometimes_late': factors.history = 50; break;
        case 'difficulty': factors.history = 20; break;
        default: factors.history = 60; // Neutral default
    }

    // Factor 4: Financial Confidence (Self-Reported) (Weight: 15%)
    switch (propensityData.financialConfidence) {
        case 'excellent': factors.confidence = 100; break;
        case 'good': factors.confidence = 80; break;
        case 'fair': factors.confidence = 50; break;
        case 'needs_improvement': factors.confidence = 20; break;
        default: factors.confidence = 60; // Neutral default
    }
    
    // Factor 5: Plan Type Factor (Weight: 10%)
    if (primaryPayer.benefits.planType === 'AggregateFamily' || indDed > 5000) {
        factors.planType = 50; // High deductible plans can be tougher
    } else {
        factors.planType = 80;
    }

    const weights = { deductibleRatio: 0.30, amount: 0.25, history: 0.20, confidence: 0.15, planType: 0.10 };
    score = (factors.deductibleRatio * weights.deductibleRatio) + (factors.amount * weights.amount) + (factors.history * weights.history) + (factors.confidence * weights.confidence) + (factors.planType * weights.planType);
    score = Math.round(score);

    let tier, recommendation;
    if (score > 75) {
        tier = 'High';
        recommendation = 'This balance appears manageable. We recommend settling the amount in full or utilizing our standard short-term payment plans.';
    } else if (score >= 40) {
        tier = 'Medium';
        recommendation = 'This balance may require some planning. We strongly recommend discussing a structured payment plan with our financial counselors to find a comfortable schedule.';
    } else {
        tier = 'Low';
        recommendation = 'This is a significant balance. Please contact our financial counselors immediately. We have several options, including extended payment plans and financial assistance programs, to help you manage this cost.';
    }

    return { score, tier, recommendation, factors };
};


// --- CORE CALCULATION LOGIC ---
// **ALGORITHM 23.0: Final QA Patches Re-applied**

const calculateCombinedEstimate = (payers, procedures, metaData, propensityData) => {
    let allPayerAdjudications = [];
    let runningProceduresState = procedures.map(p => ({ ...p, originalCharge: Number(p.billedAmount) || 0 }));
    let finalPatientResponsibility = 0;
    const cumulativePlanPaid = new Map();

    for (let i = 0; i < payers.length; i++) {
        const currentPayer = payers[i];

        const proceduresForThisPayer = runningProceduresState.map(proc => {
            const benefitsForProc = currentPayer.procedureBenefits.find(pb => pb.procedureId === proc.id);
            return { ...proc, ...benefitsForProc };
        });
        
        const currentPayerResult = calculateSinglePayerEstimate(
            currentPayer.benefits,
            currentPayer.patientAccumulators,
            currentPayer.familyAccumulators,
            proceduresForThisPayer,
            metaData,
            currentPayer.rank,
            currentPayer.insurance.name,
            cumulativePlanPaid
        );

        for (const pe of currentPayerResult.procedureEstimates) {
            const planPaidThisRound = $((pe.finalAllowedAmount || 0) - (pe.totalPatientResponsibility || 0));
            cumulativePlanPaid.set(pe.id, $((cumulativePlanPaid.get(pe.id) || 0) + planPaidThisRound));
        }

        allPayerAdjudications.push(currentPayerResult);
        finalPatientResponsibility = currentPayerResult.totalPatientResponsibility;
    }

    const propensityResult = calculatePropensityScore(finalPatientResponsibility, payers, propensityData);

    return { metaData, payers, procedures, totalPatientResponsibility: finalPatientResponsibility, adjudicationChain: allPayerAdjudications, propensity: propensityResult };
};


const calculateSinglePayerEstimate = (benefits, patientAccumulators, familyAccumulators, procedures, metaData, payerRank, payerName, cumulativePlanPaid) => {
    const sanitizeNumber = (val) => Number.isNaN(Number(val)) ? 0 : Math.max(0, Number(val));
    let currentPatientAcc = { deductibleMet: sanitizeNumber(patientAccumulators.deductibleMet), oopMet: sanitizeNumber(patientAccumulators.oopMet) };
    let currentFamilyAcc = familyAccumulators ? { deductibleMet: sanitizeNumber(familyAccumulators.deductibleMet), oopMet: sanitizeNumber(familyAccumulators.oopMet) } : null;
    if (benefits.planType === 'Individual') currentFamilyAcc = null;

    const getRemaining = (limit, met) => {
        if (limit === null || limit === undefined || limit === '') return Infinity;
        return Math.max(0, (Number(limit) || 0) - (Number(met) || 0));
    };

    let procedureEstimates = [];
    
    const remIndOop = getRemaining(benefits.individualOopMax, currentPatientAcc.oopMet);
    const remFamOop = currentFamilyAcc ? getRemaining(benefits.familyOopMax, currentFamilyAcc.oopMet) : Infinity;

    let oopMet = false, reason = '';
    if (benefits.planType === 'Individual') { oopMet = remIndOop <= 0; reason = 'Individual OOP Met'; }
    else if (benefits.planType === 'AggregateFamily' && currentFamilyAcc) { oopMet = remFamOop <= 0; reason = 'Family OOP Met'; }
    else if (benefits.planType === 'EmbeddedFamily') { oopMet = (remIndOop <= 0) || (currentFamilyAcc && remFamOop <= 0); reason = (remIndOop <= 0) ? 'Individual OOP Met' : 'Family OOP Met'; }

    if (oopMet) {
        return {
            benefits, patientId: metaData.patient.memberId, rank: payerRank, payerName,
            procedureEstimates: procedures.map(p => {
                const { modifiedAllowedAmount } = applyModifiers(p);
                const originalCharge = Number(p.originalCharge) || Number(p.billedAmount) || 0;
                const allowedBase = Math.min(modifiedAllowedAmount, originalCharge);
                const priorPaid = Number(cumulativePlanPaid?.get(p.id) || 0);
                const capForThisPayer = $(Math.max(0, allowedBase - priorPaid));
                return { ...p, totalPatientResponsibility: 0.0, finalAllowedAmount: capForThisPayer, calculationBreakdown: [{ description: reason, patientOwes: 0.0, notes: `Patient's OOP max is met.` }] };
            }),
            totalPatientResponsibility: 0.0,
            finalAccumulators: { patient: currentPatientAcc, family: currentFamilyAcc },
        }
    }

    const preventiveProcedures = procedures.filter(p => p.isPreventive);
    let standardProcedures = procedures.filter(p => !p.isPreventive).sort((a, b) => (Number(b.allowedAmount) || 0) - (Number(a.allowedAmount) || 0)).map((p, index) => ({...p, calculationRank: index + 1}));

    preventiveProcedures.forEach(p => {
        const { modifiedAllowedAmount } = applyModifiers(p);
        const originalCharge = Number(p.originalCharge) || Number(p.billedAmount) || 0;
        const allowedBase = Math.min(modifiedAllowedAmount, originalCharge);
        const priorPaid = Number(cumulativePlanPaid?.get(p.id) || 0);
        const capForThisPayer = $(Math.max(0, allowedBase - priorPaid));
        procedureEstimates.push({ ...p, totalPatientResponsibility: 0.0, calculationBreakdown: [{ description: "Preventive Service", patientOwes: 0.0, notes: "Covered at 100% by this plan." }], modifiedAllowedAmount, finalAllowedAmount: capForThisPayer });
    });

    const proceduresByDate = standardProcedures.reduce((acc, p) => {
        const date = p.dateOfService || metaData.service.date;
        if (!acc[date]) acc[date] = [];
        acc[date].push(p);
        return acc;
    }, {});
    
    let allStandardEstimates = [];
    const sortedDates = Object.keys(proceduresByDate).sort();

    for (const date of sortedDates) {
        const proceduresForDate = proceduresByDate[date];
        let dailyResult;

        switch (benefits.copayLogic) {
            case 'highest_copay_only': {
                const target = proceduresForDate.reduce((best, p) => {
                    const c = Number(p.copay) || 0;
                    if (!best) return p;
                    const cb = Number(best.copay) || 0;
                    if (c > cb) return p;
                    if (c === cb && (Number(p.allowedAmount) || 0) > (Number(best.allowedAmount) || 0)) return p;
                    return best;
                }, null);

                let totalResp = 0;
                const lines = proceduresForDate.map((p) => {
                    const { modifiedAllowedAmount } = applyModifiers(p);
                    const originalCharge = Number(p.originalCharge) || 0;
                    const allowedBase = Math.min(modifiedAllowedAmount, originalCharge);
                    const priorPaid = Number(cumulativePlanPaid?.get(p.id) || 0);
                    const capForThisPayer = $(Math.max(0, allowedBase - priorPaid));

                    if (target && p.id === target.id) {
                        const remOop = planAwareRemOop(benefits.individualOopMax, benefits.familyOopMax, currentPatientAcc.oopMet, currentFamilyAcc?.oopMet, benefits.planType);
                        const rawCopay = Number(target.copay) || 0;
                        const copayDue = $(Math.min(rawCopay, remOop, capForThisPayer));
                        if (copayDue > 0) {
                            currentPatientAcc.oopMet = $(currentPatientAcc.oopMet + copayDue);
                            if (currentFamilyAcc) currentFamilyAcc.oopMet = $(currentFamilyAcc.oopMet + copayDue);
                        }
                        totalResp = copayDue;
                        return { ...p, modifiedAllowedAmount, finalAllowedAmount: capForThisPayer, totalPatientResponsibility: copayDue, calculationBreakdown: [{ description: "Highest Copay Applied", patientOwes: copayDue, notes: `Copay for ${p.cptCode}.`}] };
                    }
                    return { ...p, modifiedAllowedAmount, finalAllowedAmount: capForThisPayer, totalPatientResponsibility: 0, calculationBreakdown: [] };
                });
                dailyResult = { totalPatientResponsibility: totalResp, procedureEstimates: lines };
                break;
            }
            case 'highest_copay_plus_remainder': {
                const target = proceduresForDate.reduce((best, p) => {
                    const c = Number(p.copay) || 0;
                    if (!best) return p;
                    const cb = Number(best.copay) || 0;
                    if (c > cb) return p;
                    if (c === cb && (Number(p.allowedAmount) || 0) > (Number(best.allowedAmount) || 0)) return p;
                    return best;
                }, null);

                let resultLines = [];
                let finalPatientAcc = currentPatientAcc;
                let finalFamilyAcc = currentFamilyAcc;

                if (target && Number(target.copay) > 0) {
                    // Process the procedure with the highest copay first, applying its full benefit logic (copay, then deductible/coinsurance).
                    const targetResult = runWaterfall([target], benefits, currentPatientAcc, currentFamilyAcc, false, cumulativePlanPaid);
                    resultLines.push(...targetResult.procedureEstimates);
                    
                    // Update accumulators to reflect the payment for the target procedure.
                    finalPatientAcc = targetResult.finalAccumulators.patient;
                    finalFamilyAcc = targetResult.finalAccumulators.family;
                    
                    // Process all other procedures for the day, but ignore their individual copays.
                    const remainingProcedures = proceduresForDate.filter(p => p.id !== target.id);
                    if (remainingProcedures.length > 0) {
                        const remainderResult = runWaterfall(remainingProcedures, benefits, finalPatientAcc, finalFamilyAcc, true, cumulativePlanPaid);
                        resultLines.push(...remainderResult.procedureEstimates);
                        // Final update to accumulators after all of the day's procedures.
                        finalPatientAcc = remainderResult.finalAccumulators.patient;
                        finalFamilyAcc = remainderResult.finalAccumulators.family;
                    }
                } else {
                    // If no procedure has a qualifying copay, run all through the standard waterfall as normal.
                    const allResult = runWaterfall(proceduresForDate, benefits, currentPatientAcc, currentFamilyAcc, false, cumulativePlanPaid);
                    resultLines = allResult.procedureEstimates;
                    finalPatientAcc = allResult.finalAccumulators.patient;
                    finalFamilyAcc = allResult.finalAccumulators.family;
                }
                
                // Set the daily result and update the main accumulators for the next date's calculation.
                currentPatientAcc = finalPatientAcc;
                currentFamilyAcc = finalFamilyAcc;
                const finalTotal = resultLines.reduce((sum, line) => sum + line.totalPatientResponsibility, 0);
                dailyResult = { totalPatientResponsibility: $(finalTotal), procedureEstimates: resultLines };
                break;
            }
            default: {
                const waterfallResult = runWaterfall(proceduresForDate, benefits, currentPatientAcc, currentFamilyAcc, false, cumulativePlanPaid);
                dailyResult = { totalPatientResponsibility: waterfallResult.totalPatientResponsibility, procedureEstimates: waterfallResult.procedureEstimates };
                currentPatientAcc = waterfallResult.finalAccumulators.patient;
                currentFamilyAcc = waterfallResult.finalAccumulators.family;
                break;
            }
        }
        allStandardEstimates.push(...dailyResult.procedureEstimates);
    }
    
    const totalResp = allStandardEstimates.reduce((sum, p) => sum + p.totalPatientResponsibility, 0) + preventiveProcedures.reduce((sum,p) => sum + p.totalPatientResponsibility, 0);
    procedureEstimates.push(...allStandardEstimates);
    procedureEstimates.sort((a,b) => procedures.findIndex(p => p.id === a.id) - procedures.findIndex(p => p.id === b.id));

    return { benefits, patientId: metaData.patient.memberId, rank: payerRank, payerName, procedureEstimates, totalPatientResponsibility: $(totalResp), finalAccumulators: { patient: currentPatientAcc, family: currentFamilyAcc } };
};

const runWaterfall = (procedures, benefits, patientAcc, familyAcc, ignoreCopays = false, cumulativePlanPaid) => {
    let currentPatientAcc = JSON.parse(JSON.stringify(patientAcc));
    let currentFamilyAcc = familyAcc ? JSON.parse(JSON.stringify(familyAcc)) : null;
    let procedureEstimates = [];
    let totalPatientResponsibility = 0.0;
    
    const getRemaining = (limit, met) => {
        if (limit === null || limit === undefined || limit === '') return Infinity;
        return Math.max(0, (Number(limit) || 0) - (Number(met) || 0));
    };

    for (const procedure of procedures) {
        const { modifiedAllowedAmount, modifierNote } = applyModifiers(procedure);
        let breakdown = [];
        if (modifierNote) { breakdown.push(modifierNote); }

        const originalCharge = Number(procedure.originalCharge) || 0;
        const allowedBase = Math.min(modifiedAllowedAmount, originalCharge);
        const priorPaid = Number(cumulativePlanPaid?.get(procedure.id) || 0);
        const capForThisPayer = $(Math.max(0, allowedBase - priorPaid));
        let amountRemainingForCalc = capForThisPayer;
        
        let patientPortion = 0.0;
        const getRemOopNow = () => planAwareRemOop(benefits.individualOopMax, benefits.familyOopMax, currentPatientAcc.oopMet, currentFamilyAcc?.oopMet, benefits.planType);
        
        const procedureCopay = !ignoreCopays ? (Number(procedure.copay) || 0) : 0;
        if (procedureCopay > 0) {
            const copayDue = $(Math.min(procedureCopay, getRemOopNow(), amountRemainingForCalc));
            if (copayDue > 0) {
                patientPortion += copayDue;
                amountRemainingForCalc = $(amountRemainingForCalc - copayDue);
                currentPatientAcc.oopMet = $(currentPatientAcc.oopMet + copayDue);
                if (currentFamilyAcc) currentFamilyAcc.oopMet = $(currentFamilyAcc.oopMet + copayDue);
                breakdown.push({ description: `Copay for ${procedure.cptCode}`, patientOwes: copayDue, notes: `Applied as a separate fee.` });
            }
        }
        
        let remIndDed = getRemaining(benefits.individualDeductible, currentPatientAcc.deductibleMet);
        let remFamDed = currentFamilyAcc ? getRemaining(benefits.familyDeductible, currentFamilyAcc.deductibleMet) : Infinity;
        let deductibleMetForPatient = (benefits.planType === 'Individual' && remIndDed <= 0) || (benefits.planType === 'AggregateFamily' && currentFamilyAcc && remFamDed <= 0) || (benefits.planType === 'EmbeddedFamily' && (remIndDed <= 0 || (currentFamilyAcc && remFamDed <= 0)));

        if (!deductibleMetForPatient && amountRemainingForCalc > 0) {
            let dedApplicable = (benefits.planType === 'Individual') ? remIndDed : (benefits.planType === 'AggregateFamily' && currentFamilyAcc) ? remFamDed : Math.min(remIndDed, currentFamilyAcc ? remFamDed : Infinity);
            const deductiblePayment = $(Math.min(amountRemainingForCalc, dedApplicable, getRemOopNow()));
            if (deductiblePayment > 0) {
                patientPortion += deductiblePayment;
                amountRemainingForCalc -= deductiblePayment;
                currentPatientAcc.deductibleMet = $(currentPatientAcc.deductibleMet + deductiblePayment);
                currentPatientAcc.oopMet = $(currentPatientAcc.oopMet + deductiblePayment);
                if (currentFamilyAcc) { 
                    currentFamilyAcc.deductibleMet = $(currentFamilyAcc.deductibleMet + deductiblePayment);
                    currentFamilyAcc.oopMet = $(currentFamilyAcc.oopMet + deductiblePayment);
                }
                breakdown.push({ description: "Deductible", patientOwes: deductiblePayment, notes: `Amount left for coinsurance: $${amountRemainingForCalc.toFixed(2)}` });
            }
        }
        
        if (amountRemainingForCalc > 0) {
            const rawPct = (procedure.coinsurancePercentage !== '' && procedure.coinsurancePercentage !== null)
                ? Number(procedure.coinsurancePercentage)
                : Number(benefits.coinsurancePercentage);
            const coinsurancePct = Number.isFinite(rawPct) ? Math.min(100, Math.max(0, rawPct)) : 0;
            const coinsuranceShare = $(amountRemainingForCalc * (coinsurancePct / 100));
            const coinsurancePayment = $(Math.min(coinsuranceShare, getRemOopNow()));
            if (coinsurancePayment > 0) {
                patientPortion += coinsurancePayment;
                currentPatientAcc.oopMet = $(currentPatientAcc.oopMet + coinsurancePayment);
                if (currentFamilyAcc) currentFamilyAcc.oopMet = $(currentFamilyAcc.oopMet + coinsurancePayment);
                breakdown.push({ description: "Coinsurance", patientOwes: coinsurancePayment, notes: `Patient pays ${coinsurancePct}% of $${amountRemainingForCalc.toFixed(2)}.` });
            }
        }

        if (patientPortion > capForThisPayer) {
            breakdown.push({ description: 'Responsibility Capped', patientOwes: 0, notes: `Patient portion ($${patientPortion.toFixed(2)}) capped at this payer's limit ($${capForThisPayer.toFixed(2)}).` });
            patientPortion = capForThisPayer;
        }
        
        totalPatientResponsibility = $(totalPatientResponsibility + patientPortion);
        procedureEstimates.push({ ...procedure, modifiedAllowedAmount, finalAllowedAmount: capForThisPayer, totalPatientResponsibility: patientPortion, calculationBreakdown: breakdown });
    }
    return { procedureEstimates, totalPatientResponsibility, finalAccumulators: { patient: currentPatientAcc, family: currentFamilyAcc } };
}

// --- UI COMPONENTS ---
const InfoTooltip = ({ text }) => ( <div className="group relative flex items-center"> <Info className="h-4 w-4 text-gray-400 cursor-pointer" /> <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">{text}</div> </div> );
const InputField = ({ label, type = "text", value, onChange, name, placeholder, tooltip, disabled=false, warning=false, ...rest }) => ( 
    <div className="flex flex-col space-y-1"> 
        <label className="text-sm font-medium text-gray-600 flex items-center space-x-2"> 
            <span>{label}</span> 
            {tooltip && <InfoTooltip text={tooltip} />}
        </label> 
        <div className="relative">
            <input 
                type={type} name={name} value={value ?? ''} onChange={onChange} placeholder={placeholder} disabled={disabled} 
                className={`p-2 w-full border rounded-md shadow-sm focus:ring-2 focus:border-blue-500 transition disabled:bg-gray-100 ${warning ? 'border-yellow-500 focus:ring-yellow-400' : 'border-gray-300 focus:ring-blue-500'}`}
                {...rest}
            />
            {warning && 
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <div className="group cursor-default">
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                        <div className="absolute right-full mr-2 w-max p-2 bg-gray-800 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">Allowed amount is greater than billed amount.</div>
                    </div>
                </div>
            }
        </div>
    </div> 
);
const Card = ({ title, icon, children, disabled = false }) => ( <div className={`bg-white p-6 rounded-xl shadow-lg border border-gray-200/80 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}> <h3 className="text-lg font-semibold text-gray-800 border-b pb-3 mb-4 flex items-center space-x-2">{icon}{title}</h3> <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div> {disabled && <div className="text-xs text-center text-gray-500 mt-2">These benefits are not applicable for the selected plan type.</div>} </div> );

const INSURANCE_PAYERS = [ 'Aetna', 'Aflac', 'Allianz', 'Allstate', 'Amerigroup', 'Anthem', 'Assurant', 'Asuris Northwest Health', 'AvMed', 'Blue Cross Blue Shield', 'BridgeSpan', 'Cambia Health Solutions', 'Capital BlueCross', 'CareFirst', 'CareSource', 'Centene Corporation', 'Cerulean', 'Cigna', 'Coventry Health Care', 'Dean Health Plan', 'Delta Dental', 'EmblemHealth', 'Fallon Health', 'Florida Blue', 'Geisinger', 'Group Health Cooperative', 'Harvard Pilgrim Health Care', 'Health Alliance Plan (HAP)', 'Health Care Service Corporation (HCSC)', 'Health Net', 'Health New England', 'HealthPartners', 'Highmark', 'Horizon Blue Cross Blue Shield of New Jersey', 'Humana', 'Independence Blue Cross', 'Kaiser Permanente', 'Liberty Mutual', 'LifeWise Health Plan of Oregon', 'LifeWise Health Plan of Washington', 'Magellan Health', 'Medical Mutual of Ohio', 'MetLife', 'Molina Healthcare', 'MVP Health Care', 'Oscar Health', 'Premera Blue Cross', 'Principal Financial Group', 'Priority Health', 'Providence Health Plan', 'Regence', 'Security Health Plan', 'SelectHealth', 'Tufts Health Plan', 'UnitedHealthcare', 'UPMC Health Plan', 'Wellcare', 'Wellmark Blue Cross Blue Shield' ];

const InsuranceCombobox = ({ value, onChange }) => {
    const [searchTerm, setSearchTerm] = React.useState(value);
    const [isOpen, setIsOpen] = React.useState(false);
    const wrapperRef = React.useRef(null);

    React.useEffect(() => { setSearchTerm(value); }, [value]);

    React.useEffect(() => {
        function handleClickOutside(event) { if (wrapperRef.current && !wrapperRef.current.contains(event.target)) { setIsOpen(false); } }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);
    
    const filteredPayers = React.useMemo(() => !searchTerm ? INSURANCE_PAYERS : INSURANCE_PAYERS.filter(p => p.toLowerCase().includes(searchTerm.toLowerCase())), [searchTerm]);

    return (
        <div className="relative" ref={wrapperRef}>
            <InputField 
                label="Insurance Plan" value={searchTerm} 
                onChange={e => { setSearchTerm(e.target.value); onChange(e.target.value); setIsOpen(true); }} 
                onFocus={() => setIsOpen(true)} placeholder="Search or type payer name"
            />
            {isOpen && (
                <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg">
                    {filteredPayers.length > 0 ? filteredPayers.map(payer => (
                        <li key={payer} className="p-2 hover:bg-blue-100 cursor-pointer text-sm" onMouseDown={() => { onChange(payer); setSearchTerm(payer); setIsOpen(false); }}>{payer}</li>
                    )) : <li className="p-2 text-sm text-gray-500">No matching payers found.</li>}
                </ul>
            )}
        </div>
    );
};

// --- Initial State Definitions ---
const createNewProcedure = () => ({ id: crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`, cptCode: '', billedAmount: '', modifiers: '', dxCode: '', isPreventive: false, dateOfService: '' });
const createNewPayer = (rank, procedures) => ({
    id: crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    rank,
    insurance: { name: '' },
    benefits: { planType: 'EmbeddedFamily', individualDeductible: '', individualOopMax: '', familyDeductible: '', familyOopMax: '', coinsurancePercentage: '', copayLogic: 'standard_waterfall' },
    patientAccumulators: { deductibleMet: '', oopMet: '' },
    familyAccumulators: { deductibleMet: '', oopMet: '' },
    procedureBenefits: procedures.map(p => ({ procedureId: p.id, allowedAmount: '', copay: '', coinsurancePercentage: '' }))
});
const blankMetaData = { patient: { name: '', memberId: '', dob: '' }, practice: { name: '', taxId: '' }, provider: { name: '', npi: '' }, service: { date: '' } };
const blankPropensityData = { paymentHistory: '', financialConfidence: '' };

// --- PAGE 1: ESTIMATE FORM ---
const EstimateForm = ({ payers, setPayers, procedures, setProcedures, metaData, setMetaData, propensityData, setPropensityData, handleReset, setEstimateData, setPage, showModal }) => {
    
    React.useEffect(() => {
        if (metaData.service.date) {
            setProcedures(prevProcs => prevProcs.map(p => p.dateOfService ? p : { ...p, dateOfService: metaData.service.date }));
        }
    }, [metaData.service.date, setProcedures]);

    const handlePayerChange = (id, section, field, value) => {
        setPayers(prev => prev.map(p => p.id === id ? { ...p, [section]: { ...p[section], [field]: value } } : p));
    };

    const handlePayerProcedureBenefitChange = (payerId, procedureId, e) => {
        const { name, value } = e.target;
        setPayers(prevPayers => prevPayers.map(p => {
            if (p.id === payerId) {
                return { ...p, procedureBenefits: p.procedureBenefits.map(pb => pb.procedureId === procedureId ? { ...pb, [name]: value } : pb) };
            }
            return p;
        }));
    };
    
    const handlePayerBenefitChange = (id, e) => {
        const { name, value } = e.target;
        setPayers(prev => prev.map(p => {
            if (p.id === id) {
                const newBenefits = { ...p.benefits, [name]: value };
                let newPatientAcc = p.patientAccumulators;
                let newFamilyAcc = p.familyAccumulators;
                if (name === 'planType') {
                    if(value === 'Individual') { newBenefits.familyDeductible = ''; newBenefits.familyOopMax = ''; newFamilyAcc = { deductibleMet: '', oopMet: ''}; }
                    if(value === 'AggregateFamily') { newBenefits.individualDeductible = ''; newBenefits.individualOopMax = ''; newPatientAcc = { deductibleMet: '', oopMet: ''}; }
                }
                return { ...p, benefits: newBenefits, patientAccumulators: newPatientAcc, familyAccumulators: newFamilyAcc };
            }
            return p;
        }));
    };

    const handleMetaDataChange = (section, e) => setMetaData(prev => ({ ...prev, [section]: { ...prev[section], [e.target.name]: e.target.value } }));
    
    const handleProcedureChange = (id, e) => {
        const { name, value, type, checked } = e.target;
        setProcedures(prevProcs => prevProcs.map(p => p.id === id ? { ...p, [name]: type === 'checkbox' ? checked : value } : p));
    };

    const handlePropensityChange = (e) => {
        const { name, value } = e.target;
        setPropensityData(prev => ({ ...prev, [name]: value }));
    };
    
    const addProcedure = () ->
 const addProcedure = () => {
        const newProc = createNewProcedure();
        newProc.dateOfService = metaData.service.date;
        setProcedures(prev => [...prev, newProc]);
        setPayers(prev => prev.map(p => ({ ...p, procedureBenefits: [...p.procedureBenefits, { procedureId: newProc.id, allowedAmount: '', copay: '', coinsurancePercentage: '' }] })));
    };

    const removeProcedure = (id) => {
        setProcedures(prev => prev.filter(p => p.id !== id));
        setPayers(prev => prev.map(p => ({ ...p, procedureBenefits: p.procedureBenefits.filter(pb => pb.procedureId !== id) })));
    };

    const addPayer = () => {
        if (payers.length < 3) {
            const rank = payers.length === 1 ? 'Secondary' : 'Tertiary';
            setPayers(prev => [...prev, createNewPayer(rank, procedures)]);
        }
    };
    const removePayer = (id) => setPayers(prev => prev.filter(p => p.id !== id));

    const handleSubmit = (e) => {
        e.preventDefault();
        
        const requiredMetaData = { "Patient Name": metaData.patient.name, "Member ID": metaData.patient.memberId, "Practice Name": metaData.practice.name, "Provider Name": metaData.provider.name, "Date of Service": metaData.service.date };
        for (const [fieldName, value] of Object.entries(requiredMetaData)) { if (!value || String(value).trim() === '') { showModal('Missing Information', `Please enter a value for "${fieldName}".`); return; } }
        
        if (metaData.patient.dob) {
            const dob = new Date(metaData.patient.dob + 'T00:00:00');
            const today = new Date(); today.setHours(0,0,0,0);
            if (dob > today) { showModal('Validation Error', 'Date of Birth cannot be in the future.'); return; }
            if (metaData.service.date) {
                const dos = new Date(metaData.service.date + 'T00:00:00');
                if (dob > dos) { showModal('Validation Error', 'Date of Birth cannot be after the Date of Service.'); return; }
            }
        }
        
        const activeProcedures = procedures.filter(p => p.cptCode || p.billedAmount);
        if (activeProcedures.length === 0) { showModal('Missing Information', 'Please add at least one procedure.'); return; }
        if (procedures.length > activeProcedures.length) { showModal('Incomplete Procedure', 'Please fill in or delete blank procedure lines.'); return; }
        
        for (const [index, proc] of activeProcedures.entries()) { 
            if (!proc.cptCode) { showModal('Incomplete Procedure', `Procedure #${index + 1} is missing a CPT Code.`); return; }
            for (const payer of payers) {
                const benefit = payer.procedureBenefits.find(pb => pb.procedureId === proc.id);
                if (!benefit || benefit.allowedAmount === '' || benefit.allowedAmount === null) {
                    showModal('Incomplete Procedure', `Procedure #${index + 1} (${proc.cptCode}) is missing an Allowed Amount for the ${payer.rank} Payer.`);
                    return;
                }
            }
        }

        for (const payer of payers) {
            if (!payer.insurance.name) { showModal('Validation Error', `Please select an insurance plan for the ${payer.rank} Payer.`); return; }
            const { benefits, patientAccumulators, familyAccumulators } = payer;
            const num = (v) => (v === '' || v === null ? null : Number(v));
            const indDed = num(benefits.individualDeductible), famDed = num(benefits.familyDeductible), indOop = num(benefits.individualOopMax), famOop = num(benefits.familyOopMax);
            const indDedMet = num(patientAccumulators.deductibleMet), famDedMet = num(familyAccumulators.deductibleMet), indOopMet = num(patientAccumulators.oopMet), famOopMet = num(familyAccumulators.oopMet);

            if (benefits.planType === 'EmbeddedFamily') {
                if (indDed !== null && famDed !== null && indDed > famDed) { showModal('Validation Error', `${payer.rank} Payer: Individual Deductible cannot be greater than Family Deductible.`); return; }
                if (indOop !== null && famOop !== null && indOop > famOop) { showModal('Validation Error', `${payer.rank} Payer: Individual OOP Max cannot be greater than Family OOP Max.`); return; }
            }
            if (indDed !== null && indDedMet !== null && indDedMet > indDed) { showModal('Validation Error', `${payer.rank} Payer: Individual Deductible Met cannot be greater than the Individual Deductible max.`); return; }
            if (indOop !== null && indOopMet !== null && indOopMet > indOop) { showModal('Validation Error', `${payer.rank} Payer: Individual OOP Met cannot be greater than the Individual OOP max.`); return; }
            if (famDed !== null && famDedMet !== null && famDedMet > famDed) { showModal('Validation Error', `${payer.rank} Payer: Family Deductible Met cannot be greater than the Family Deductible max.`); return; }
            if (famOop !== null && famOopMet !== null && famOopMet > famOop) { showModal('Validation Error', `${payer.rank} Payer: Family OOP Met cannot be greater than the Family OOP max.`); return; }
        }

        const result = calculateCombinedEstimate(payers, activeProcedures, metaData, propensityData);
        setEstimateData(result);
        setPage('results');
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-end mb-4"><button type="button" onClick={handleReset} className="flex items-center space-x-2 text-sm bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition"><XCircle className="h-4 w-4" /><span>Clear Form</span></button></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title="Patient & Service" icon={<User className="text-blue-600" />}><InputField label="Patient Name" name="name" value={metaData.patient.name} onChange={e => handleMetaDataChange('patient', e)} /><InputField label="Member ID" name="memberId" value={metaData.patient.memberId} onChange={e => handleMetaDataChange('patient', e)} /><InputField label="Date of Birth" name="dob" type="date" value={metaData.patient.dob} onChange={e => handleMetaDataChange('patient', e)} /><InputField label="Date of Service" name="date" type="date" value={metaData.service.date} onChange={e => handleMetaDataChange('service', e)} /></Card>
                <Card title="Practice Details" icon={<Stethoscope className="text-blue-600" />}><InputField label="Practice Name" name="name" value={metaData.practice.name} onChange={e => handleMetaDataChange('practice', e)} /><InputField label="Practice Tax ID" name="taxId" value={metaData.practice.taxId} onChange={e => handleMetaDataChange('practice', e)} /><InputField label="Provider Name" name="name" value={metaData.provider.name} onChange={e => handleMetaDataChange('provider', e)} /><InputField label="Provider NPI" name="npi" value={metaData.provider.npi} onChange={e => handleMetaDataChange('provider', e)} /></Card>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200/80">
                 <h3 className="text-lg font-semibold text-gray-800 border-b pb-3 mb-4">Procedures</h3>
                 <div className="space-y-4">
                     {procedures.map((p, index) => (
                        <div key={p.id} className="grid grid-cols-1 md:grid-cols-6 gap-x-4 gap-y-2 bg-gray-50 p-3 rounded-lg items-start">
                           <InputField label={`CPT #${index+1}`} name="cptCode" value={p.cptCode} onChange={e => handleProcedureChange(p.id, e)} placeholder="e.g., 99214" />
                           <InputField label="Date of Service" name="dateOfService" type="date" value={p.dateOfService} onChange={e => handleProcedureChange(p.id, e)} tooltip="Defaults to the main DOS."/>
                           <InputField label="DX Codes" name="dxCode" value={p.dxCode} onChange={e => handleProcedureChange(p.id, e)} placeholder="e.g., M17.11" tooltip="Primary diagnosis code."/>
                           <InputField label="Modifiers" name="modifiers" value={p.modifiers} onChange={e => handleProcedureChange(p.id, e)} placeholder="e.g., 50, LT" tooltip="Comma-separated. Pricing mods like 50/62 will adjust allowed amount."/>
                           <InputField type="number" label="Billed ($)" name="billedAmount" value={p.billedAmount} onChange={e => handleProcedureChange(p.id, e)} placeholder="e.g., 400" />
                           <div className="flex flex-col items-center space-y-2 mt-1">
                                <label className="text-sm font-medium text-gray-600">Actions</label>
                                <div className="flex items-center h-10 space-x-3">
                                <button type="button" onClick={() => removeProcedure(p.id)} className="text-red-500 hover:text-red-700 transition"><Trash2 className="h-5 w-5"/></button>
                                <div className="group relative flex items-center">
                                    <input type="checkbox" name="isPreventive" checked={p.isPreventive} onChange={e => handleProcedureChange(p.id, e)} className="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500"/>
                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-max p-2 bg-gray-800 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">Preventive (100% Covered)</div>
                                </div>
                               </div>
                           </div>
                        </div>
                     ))}
                 </div>
                 <button type="button" onClick={addProcedure} className="mt-4 flex items-center space-x-2 text-blue-600 font-medium hover:text-blue-800 transition"><PlusCircle className="h-5 w-5" /><span>Add Procedure</span></button>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200/80">
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-3 mb-4 flex items-center space-x-2"><Wallet className="text-blue-600" /> <span>Financial Planning Inputs (Optional & Confidential)</span></h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium text-gray-600 flex items-center space-x-2">Patient Payment History</label>
                        <select name="paymentHistory" value={propensityData.paymentHistory} onChange={handlePropensityChange} className="w-full p-2 border border-gray-300 rounded-md shadow-sm">
                            <option value="">Select an option</option>
                            <option value="on_time">Always pay medical bills on time</option>
                            <option value="payment_plan">Have used payment plans before</option>
                            <option value="sometimes_late">Sometimes late, but always pay</option>
                            <option value="difficulty">Have had difficulty paying large bills</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-600 flex items-center space-x-2">Current Financial Confidence</label>
                        <select name="financialConfidence" value={propensityData.financialConfidence} onChange={handlePropensityChange} className="w-full p-2 border border-gray-300 rounded-md shadow-sm">
                            <option value="">Select an option</option>
                            <option value="excellent">Excellent - Confident I can cover costs</option>
                            <option value="good">Good - Can cover costs, may need to budget</option>
                            <option value="fair">Fair - A large bill would be a challenge</option>
                            <option value="needs_improvement">Needs Improvement - Concerned about ability to pay</option>
                        </select>
                    </div>
                </div>
                 <p className="text-xs text-gray-500 mt-3 text-center"><ShieldCheck className="h-4 w-4 inline mr-1"/>This information is confidential, not stored, and used only to provide helpful guidance on managing your estimated costs.</p>
            </div>

            <div className="space-y-6">
            {payers.map((payer, index) => {
                const isFamilyPlan = payer.benefits.planType !== 'Individual';
                const isIndividualBenefitsDisabled = payer.benefits.planType === 'AggregateFamily';
                return (
                <div key={payer.id} className="bg-white p-6 rounded-xl shadow-lg border border-gray-200/80">
                    <div className="flex justify-between items-center border-b pb-3 mb-4">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center space-x-2"><Briefcase className="text-blue-600" /> <span>{payer.rank} Insurance Plan</span></h3>
                        {index > 0 && <button type="button" onClick={() => removePayer(payer.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-5 w-5"/></button>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <InsuranceCombobox value={payer.insurance.name} onChange={(val) => handlePayerChange(payer.id, 'insurance', 'name', val)} />
                        <div><label className="text-sm font-medium text-gray-600">Plan Type</label><select name="planType" value={payer.benefits.planType} onChange={(e) => handlePayerBenefitChange(payer.id, e)} className="w-full p-2 border border-gray-300 rounded-md shadow-sm"><option value="EmbeddedFamily">Embedded Family</option><option value="AggregateFamily">Aggregate Family</option><option value="Individual">Individual</option></select></div>
                        <InputField type="number" label="Default Coinsurance (%)" name="coinsurancePercentage" value={payer.benefits.coinsurancePercentage} onChange={e => handlePayerBenefitChange(payer.id, e)} placeholder="e.g., 20" />
                        <div className="md:col-span-2"><label className="text-sm font-medium text-gray-600 flex items-center space-x-2"><span>Copayment Logic</span><InfoTooltip text="Select how this plan handles copayments."/></label><select name="copayLogic" value={payer.benefits.copayLogic} onChange={e => handlePayerBenefitChange(payer.id, e)} className="w-full p-2 border border-gray-300 rounded-md shadow-sm"><option value="standard_waterfall">Apply Each Copay</option><option value="highest_copay_only">Highest Copay Only</option><option value="highest_copay_plus_remainder">Highest Copay + Waterfall</option></select></div>
                    </div>
                    
                    <h4 className="text-md font-semibold text-gray-700 mb-3">Procedure-Specific Benefits</h4>
                    <div className="space-y-2">
                        {procedures.map(proc => {
                            const benefit = payer.procedureBenefits.find(pb => pb.procedureId === proc.id);
                            const isPreventive = proc.isPreventive;
                            return (
                                <div key={proc.id} className="grid grid-cols-4 gap-x-3 gap-y-2 bg-gray-50 p-2 rounded-md items-end">
                                    <div className="font-medium text-sm text-gray-800 self-center">CPT: {proc.cptCode || "N/A"}</div>
                                    <InputField type="number" label="Allowed ($)" name="allowedAmount" value={benefit?.allowedAmount} onChange={e => handlePayerProcedureBenefitChange(payer.id, proc.id, e)} placeholder="e.g., 250" warning={ benefit?.allowedAmount !== '' && proc.billedAmount !== '' && Number(benefit?.allowedAmount) > Number(proc.billedAmount) } />
                                    <InputField type="number" label="Copay ($)" name="copay" value={benefit?.copay} onChange={e => handlePayerProcedureBenefitChange(payer.id, proc.id, e)} placeholder="e.g., 50" disabled={isPreventive} />
                                    <InputField type="number" label="Coins. (%)" name="coinsurancePercentage" value={benefit?.coinsurancePercentage} onChange={e => handlePayerProcedureBenefitChange(payer.id, proc.id, e)} placeholder="Plan Default" disabled={isPreventive} />
                                </div>
                            )
                        })}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                        <Card title="Individual Accumulators" icon={<User className="h-5 w-5 text-gray-500"/>} disabled={isIndividualBenefitsDisabled}><InputField type="number" label="Deductible ($)" name="individualDeductible" value={payer.benefits.individualDeductible} onChange={e => handlePayerBenefitChange(payer.id, e)} /><InputField type="number" label="OOP Max ($)" name="individualOopMax" value={payer.benefits.individualOopMax} onChange={e => handlePayerBenefitChange(payer.id, e)} /><InputField type="number" label="Deductible Met ($)" name="deductibleMet" value={payer.patientAccumulators.deductibleMet} onChange={e => handlePayerChange(payer.id, 'patientAccumulators', 'deductibleMet', e.target.value)} /><InputField type="number" label="OOP Met ($)" name="oopMet" value={payer.patientAccumulators.oopMet} onChange={e => handlePayerChange(payer.id, 'patientAccumulators', 'oopMet', e.target.value)} /></Card>
                        <Card title="Family Accumulators" icon={<Users className="h-5 w-5 text-gray-500"/>} disabled={!isFamilyPlan}><InputField type="number" label="Deductible ($)" name="familyDeductible" value={payer.benefits.familyDeductible} onChange={e => handlePayerBenefitChange(payer.id, e)} /><InputField type="number" label="OOP Max ($)" name="familyOopMax" value={payer.benefits.familyOopMax} onChange={e => handlePayerBenefitChange(payer.id, e)} /><InputField type="number" label="Deductible Met ($)" name="deductibleMet" value={payer.familyAccumulators.deductibleMet} onChange={e => handlePayerChange(payer.id, 'familyAccumulators', 'deductibleMet', e.target.value)} /><InputField type="number" label="OOP Met ($)" name="oopMet" value={payer.familyAccumulators.oopMet} onChange={e => handlePayerChange(payer.id, 'familyAccumulators', 'oopMet', e.target.value)} /></Card>
                    </div>
                </div>
                )})}
            </div>
            {payers.length < 3 && <button type="button" onClick={addPayer} className="flex items-center space-x-2 text-blue-600 font-medium hover:text-blue-800 transition"><PlusCircle className="h-5 w-5"/><span>{payers.length === 1 ? 'Add Secondary Insurance' : 'Add Tertiary Insurance'}</span></button>}
            
            <div className="flex justify-end pt-4"><button type="submit" className="flex items-center space-x-2 bg-blue-600 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-blue-700 transition transform hover:scale-105"><span>Calculate Estimate</span><ArrowRight className="h-5 w-5" /></button></div>
        </form>
    );
};

// --- PAGE 2: RESULTS DISPLAY & PDF GENERATION ---
const EstimateResults = ({ data, setPage, scriptsLoaded }) => {
    const [expandedSections, setExpandedSections] = React.useState({});
    const toggleSection = (id) => setExpandedSections(prev => ({...prev, [id]: !prev[id]}));
    const copayLogicDescriptions = { standard_waterfall: "Each service's copay was applied, followed by the standard deductible and coinsurance waterfall.", highest_copay_only: "The single highest copay was applied as the total patient cost for all services.", highest_copay_plus_remainder: "The highest copay was applied, and all other services were then processed against the deductible and coinsurance." };
    
    const PropensityDisplay = ({ propensity }) => {
        const { tier, recommendation } = propensity;
        const tierInfo = {
            High: { color: 'green', icon: <TrendingUp/>, title: 'High Readiness' },
            Medium: { color: 'yellow', icon: <TrendingDown/>, title: 'Medium Readiness' },
            Low: { color: 'red', icon: <AlertTriangle/>, title: 'Low Readiness' },
        };
        const currentTier = tierInfo[tier];

        return (
            <div className={`bg-white p-6 rounded-xl shadow-lg border-l-4 border-${currentTier.color}-500`}>
                <h3 className="text-xl font-semibold text-gray-800 mb-2 flex items-center">
                    <span className={`text-${currentTier.color}-600 mr-2`}>{currentTier.icon}</span>
                    Payment Readiness Guide: <span className={`ml-2 text-${currentTier.color}-600`}>{currentTier.title}</span>
                </h3>
                <p className="text-gray-600 text-sm">{recommendation}</p>
            </div>
        );
    };

    const generatePDF = () => {
        if (!scriptsLoaded || !window.jspdf) {
            alert("PDF generation library is still loading...");
            return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const pageW = doc.internal.pageSize.getWidth();
        const margin = 15;
        let cursorY = 20;

        // --- Colors ---
        const primaryColor = '#0D47A1'; // A deep, corporate blue
        const secondaryColor = '#424242'; // Dark grey for text
        const lightGreyColor = '#E0E0E0'; // For borders and lines
        const backgroundColor = '#F5F5F5'; // For table headers and footers
        
        // --- Header ---
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.setTextColor(primaryColor);
        doc.text(appConfig.brandName, margin, cursorY);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(secondaryColor);
        doc.text('Good Faith Estimate', pageW - margin, cursorY - 5, { align: 'right' });
        doc.text(`Date: ${new Date().toLocaleDateString('en-US')}`, pageW - margin, cursorY, { align: 'right' });
        cursorY += 10;
        doc.setDrawColor(lightGreyColor);
        doc.line(margin, cursorY, pageW - margin, cursorY);
        cursorY += 10;

        // --- Meta Info Table ---
        const metaBody = [
            [{ content: 'Patient:', styles: { fontStyle: 'bold' }}, `${data.metaData.patient.name} (ID: ${data.metaData.patient.memberId})`],
            [{ content: 'Provider:', styles: { fontStyle: 'bold' }}, `${data.metaData.provider.name} (NPI: ${data.metaData.provider.npi || 'N/A'})`],
            [{ content: 'Service Date:', styles: { fontStyle: 'bold' }}, formatDate(data.metaData.service.date)],
            [{ content: 'Practice:', styles: { fontStyle: 'bold' }}, `${data.metaData.practice.name} (TIN: ${data.metaData.practice.taxId || 'N/A'})`],
        ];
        doc.autoTable({
            startY: cursorY,
            body: metaBody,
            theme: 'plain',
            styles: { fontSize: 9, cellPadding: 1.5, textColor: secondaryColor },
            columnStyles: { 0: { cellWidth: 35 } }
        });
        cursorY = doc.autoTable.previous.finalY + 12;

        // --- Summary Box ---
        doc.setFillColor('#E3F2FD'); // Light blue background
        doc.setDrawColor(primaryColor);
        doc.roundedRect(margin, cursorY, pageW - (margin * 2), 25, 3, 3, 'FD');
        doc.setFontSize(12);
        doc.setTextColor(secondaryColor);
        doc.text("Estimated Patient Responsibility", margin + 5, cursorY + 10);

        doc.setFontSize(26);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(primaryColor);
        doc.text(`$${data.totalPatientResponsibility.toFixed(2)}`, pageW - margin - 5, cursorY + 17, { align: 'right' });
        cursorY += 35;

        // --- Propensity to Pay Section ---
        const { tier, recommendation } = data.propensity;
        const tierColors = { High: '#4CAF50', Medium: '#FFC107', Low: '#F44336' };
        doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(secondaryColor).text("Payment Readiness Guide", margin, cursorY);
        cursorY += 6;
        doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(tierColors[tier]).text(tier, margin, cursorY);
        cursorY += 6;
        doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(secondaryColor);
        const splitRecommendation = doc.splitTextToSize(recommendation, pageW - (margin * 2));
        doc.text(splitRecommendation, margin, cursorY);
        cursorY += (splitRecommendation.length * 4) + 8;
        
        // --- Detailed Breakdown Section ---
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(secondaryColor);
        doc.text("Coordination of Benefits Breakdown", margin, cursorY);
        cursorY += 8;

        const tableOptions = {
            theme: 'grid',
            headStyles: {
                fillColor: '#424242',
                textColor: '#FFFFFF',
                fontStyle: 'bold',
                halign: 'center'
            },
            footStyles: {
                fillColor: backgroundColor,
                textColor: secondaryColor,
                fontStyle: 'bold',
            },
            alternateRowStyles: {
                fillColor: '#FBFBFB'
            },
            styles: {
                fontSize: 9,
                cellPadding: 2,
                lineColor: lightGreyColor,
                lineWidth: 0.1,
            },
            columnStyles: {
                1: { halign: 'right' },
                2: { halign: 'right' },
            }
        };

        for (const proc of data.procedures) {
             if (cursorY > doc.internal.pageSize.getHeight() - 60) {
                doc.addPage();
                cursorY = margin;
            }

            const tableBody = [];
            let finalResponsibility = 0;

            for (const adj of data.adjudicationChain) {
                const p = adj.procedureEstimates.find(pe => pe.id === proc.id);
                if (p) {
                    const payerPayment = $((p.finalAllowedAmount || 0) - (p.totalPatientResponsibility || 0));
                    tableBody.push([adj.payerName, `$${payerPayment.toFixed(2)}`, `$${p.totalPatientResponsibility.toFixed(2)}`]);
                    finalResponsibility = p.totalPatientResponsibility;
                }
            }

            doc.autoTable({
                ...tableOptions,
                startY: cursorY,
                head: [[
                    { content: `Service: ${proc.cptCode} | Billed: $${Number(proc.originalCharge).toFixed(2)}`, colSpan: 3, styles: { fillColor: primaryColor, textColor: '#FFFFFF', fontStyle: 'bold', halign: 'left' } }
                ]],
                body: tableBody,
                foot: [[
                    { content: `Final Responsibility for ${proc.cptCode}`, colSpan: 2, styles: { halign: 'right' } },
                    { content: `$${finalResponsibility.toFixed(2)}`, styles: { halign: 'right' } }
                ]],
                columns: [
                    { header: 'Payer Adjudication', dataKey: 'payer' },
                    { header: 'Est. Payer Payment', dataKey: 'payment' },
                    { header: 'Est. Patient Portion', dataKey: 'responsibility' },
                ],
            });
            cursorY = doc.autoTable.previous.finalY + 10;
        }

        // --- Footer with Page Numbers ---
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            const footerY = doc.internal.pageSize.getHeight() - 15;
            doc.setDrawColor(lightGreyColor);
            doc.line(margin, footerY, pageW - margin, footerY);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor('#9E9E9E');

            const disclaimer = "Disclaimer: This is a good faith estimate and not a guarantee of payment. The final amount is subject to services rendered and the insurance plans' final determination of benefits.";
            doc.text(disclaimer, margin, footerY + 8);
            
            const pageNumText = `Page ${i} of ${pageCount}`;
            doc.text(pageNumText, pageW - margin, footerY + 8, { align: 'right' });
        }
        
        doc.save(`GoodFaithEstimate_${data.metaData.patient.memberId}_${new Date().toISOString().slice(0,10)}.pdf`);
    };

    return (
        <div className="space-y-8">
            <div className="text-center"> <h2 className="text-3xl font-bold text-gray-800">Calculation Complete</h2> <p className="text-gray-500 mt-1">Review the coordinated benefits estimate below.</p> </div>
            <div className="bg-white p-8 rounded-xl shadow-2xl border border-gray-200/80 text-center max-w-lg mx-auto"> <p className="text-lg text-gray-600">Final Estimated Patient Responsibility</p> <p className="text-6xl font-extrabold text-blue-600 tracking-tight my-2">${data.totalPatientResponsibility.toFixed(2)}</p> </div>
            
            <PropensityDisplay propensity={data.propensity} />

             <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200/80">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Estimate Context</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><strong>Patient:</strong> {data.metaData.patient.name} ({data.metaData.patient.memberId})</div>
                    <div><strong>Provider:</strong> {data.metaData.provider.name}</div>
                    <div><strong>Service Date:</strong> {formatDate(data.metaData.service.date)}</div>
                    <div><strong>Practice:</strong> {data.metaData.practice.name}</div>
                    {data.payers.map(p => <div key={p.id}><strong>{p.rank} Insurance:</strong> {p.insurance.name}</div>)}
                </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200/80">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Detailed Adjudication Breakdown</h3>
                <div className="space-y-4">
                    {data.adjudicationChain.map((adj, adjIdx) => {
                        const isPayerExpanded = !!expandedSections[`payer-${adjIdx}`];
                        const totalPayerPayment = adj.procedureEstimates.reduce((sum, p) => sum + ((p.finalAllowedAmount || 0) - p.totalPatientResponsibility), 0);
                        return (
                        <div key={adjIdx} className="border border-gray-200 rounded-lg">
                            <button onClick={() => toggleSection(`payer-${adjIdx}`)} className="w-full bg-gray-50 hover:bg-gray-100 p-4 text-left flex justify-between items-center transition">
                                <div>
                                    <h4 className="font-bold text-gray-800 text-lg">{adj.rank} Payer: {adj.payerName}</h4>
                                    <p className="text-sm text-gray-600">Payer Payment: <span className="font-semibold text-green-700">${totalPayerPayment.toFixed(2)}</span> | Patient Responsibility After This Payer: <span className="font-semibold text-red-700">${adj.totalPatientResponsibility.toFixed(2)}</span></p>
                                </div>
                                {isPayerExpanded ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
                            </button>
                            {isPayerExpanded && (
                                <div className="p-4 space-y-3">
                                    <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md border border-blue-200"><Info className="h-4 w-4 inline-block mr-2 text-blue-700" /><strong>Logic Applied:</strong> {copayLogicDescriptions[adj.benefits.copayLogic]}</div>
                                    {adj.procedureEstimates.map((p, pIdx) => {
                                        const isProcExpanded = !!expandedSections[`proc-${adjIdx}-${pIdx}`];
                                        return (
                                        <div key={pIdx} className="border bg-white rounded-md">
                                            <button onClick={() => toggleSection(`proc-${adjIdx}-${pIdx}`)} className="w-full p-3 text-left flex justify-between items-center">
                                                <div>
                                                    <p className="font-semibold text-gray-700">CPT: {p.cptCode} {p.calculationRank && <span className="ml-2 text-xs font-bold text-red-600 bg-red-100 rounded-full h-5 w-5 flex items-center justify-center">{p.calculationRank}</span>}</p>
                                                    <p className="text-xs text-gray-500">Charge: ${Number(p.originalCharge).toFixed(2)} | Allowed for this Payer: ${(p.finalAllowedAmount || 0).toFixed(2)} | Patient Owes: ${p.totalPatientResponsibility.toFixed(2)}</p>
                                                </div>
                                                {isProcExpanded ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
                                            </button>
                                            {isProcExpanded && (
                                                <div className="p-3 border-t">
                                                    <table className="w-full text-sm">
                                                        <thead><tr className="bg-gray-100 text-left text-gray-600"><th className="p-2 font-semibold">Cost Component</th><th className="p-2 font-semibold">Patient Pays</th><th className="p-2 font-semibold">Notes</th></tr></thead>
                                                        <tbody>
                                                            {p.calculationBreakdown.map((step, stepIdx) => ( <tr key={stepIdx} className="border-t"><td className="p-2">{step.description}</td><td className="p-2 font-mono text-right">${step.patientOwes.toFixed(2)}</td><td className="p-2 text-gray-500">{step.notes}</td></tr> ))}
                                                            {p.calculationBreakdown.length === 0 && ( <tr className="border-t"><td colSpan="3" className="p-2 text-center text-gray-500">No patient cost components for this step.</td></tr> )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    )})}
                                </div>
                            )}
                        </div>
                    )})}
                </div>
            </div>

            <div className="flex justify-between items-center pt-4">
                 <button onClick={() => setPage('form')} className="flex items-center space-x-2 bg-gray-200 text-gray-800 font-bold py-3 px-6 rounded-lg hover:bg-gray-300 transition"><ArrowLeft className="h-5 w-5" /><span>Back to Form</span></button>
                 <button onClick={generatePDF} disabled={!scriptsLoaded} className="flex items-center space-x-2 bg-green-600 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-green-700 transition transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:scale-100">
                    {scriptsLoaded ? <FileDown className="h-5 w-5" /> : <Loader className="h-5 w-5 animate-spin" />}
                    <span>{scriptsLoaded ? 'Download PDF' : 'Loading...'}</span>
                </button>
            </div>
        </div>
    );
};

// --- Modal Component ---
const Modal = ({ isOpen, onClose, title, message }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md m-4">
                <div className="flex justify-between items-center border-b pb-3"><h3 className="text-lg font-semibold text-gray-800">{title}</h3><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XCircle className="h-6 w-6" /></button></div>
                <div className="mt-4"><p className="text-sm text-gray-600">{message}</p></div>
                <div className="mt-6 flex justify-end"><button onClick={onClose} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition">OK</button></div>
            </div>
        </div>
    );
};


// --- MAIN APP CONTAINER ---
const App = () => {
    const [page, setPage] = React.useState('form');
    const [estimateData, setEstimateData] = React.useState(null);
    const [scriptsLoaded, setScriptsLoaded] = React.useState(false);
    const [modal, setModal] = React.useState({ isOpen: false, title: '', message: '' });

    const showModal = (title, message) => setModal({ isOpen: true, title, message });
    const hideModal = () => setModal({ isOpen: false, title: '', message: '' });

    // Lifted state for form data persistence
    const [procedures, setProcedures] = React.useState([createNewProcedure()]);
    const [payers, setPayers] = React.useState([createNewPayer('Primary', procedures)]);
    const [metaData, setMetaData] = React.useState(blankMetaData);
    const [propensityData, setPropensityData] = React.useState(blankPropensityData);

    const handleReset = () => {
        const initialProcs = [createNewProcedure()];
        setProcedures(initialProcs);
        setPayers([createNewPayer('Primary', initialProcs)]);
        setMetaData(blankMetaData);
        setPropensityData(blankPropensityData);
    };

    React.useEffect(() => {
        const jspdfScript = document.createElement('script');
        jspdfScript.id = 'jspdf-script';
        jspdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        jspdfScript.async = true;
    
        jspdfScript.onload = () => {
            const autoTableScript = document.createElement('script');
            autoTableScript.id = 'jspdf-autotable-script';
            autoTableScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js';
            autoTableScript.async = true;
    
            autoTableScript.onload = () => {
                setScriptsLoaded(true);
            };
            autoTableScript.onerror = () => {
                console.error("Failed to load jsPDF-AutoTable script.");
            };
            document.head.appendChild(autoTableScript);
        };
    
        jspdfScript.onerror = () => {
            console.error("Failed to load jsPDF script.");
        };
    
        document.head.appendChild(jspdfScript);
    
        return () => {
            document.getElementById('jspdf-script')?.remove();
            document.getElementById('jspdf-autotable-script')?.remove();
        };
    }, []);

    return (
        <div className="bg-gray-50 min-h-screen font-sans">
            <Modal isOpen={modal.isOpen} onClose={hideModal} title={modal.title} message={modal.message} />
            <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-5xl">
                <header className="text-center my-8">
                    <BrandHeader brandName={appConfig.brandName} />
                    <h1 className="text-4xl font-extrabold text-gray-800 mt-4 tracking-tight"> {appConfig.appTitle} </h1>
                    <p className="text-gray-500 mt-2 max-w-2xl mx-auto"> {appConfig.appSubtitle} </p>
                </header>
                <main className="transition-opacity duration-500">
                    {page === 'form' ? ( 
                        <EstimateForm 
                            payers={payers} setPayers={setPayers}
                            procedures={procedures} setProcedures={setProcedures}
                            metaData={metaData} setMetaData={setMetaData}
                            propensityData={propensityData} setPropensityData={setPropensityData}
                            handleReset={handleReset}
                            setEstimateData={setEstimateData} 
                            setPage={setPage} 
                            showModal={showModal}
                        /> 
                    ) : ( 
                        estimateData && <EstimateResults data={estimateData} setPage={setPage} scriptsLoaded={scriptsLoaded} /> 
                    )}
                </main>
                <footer className="text-center text-xs text-gray-400 mt-12 pb-6">
                    <p> This is a good faith estimate and not a guarantee of final cost. Final determination is made by the payer. </p>
                    <p>&copy; {new Date().getFullYear()} {appConfig.brandName} All Rights Reserved.</p>
                </footer>
            </div>
        </div>
    );
}

export default App;

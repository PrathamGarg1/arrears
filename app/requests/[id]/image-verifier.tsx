'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileImage, X, CheckCircle, AlertCircle, Loader2, ChevronRight, ChevronLeft, Download, FileSpreadsheet } from 'lucide-react'
import { processMultipleImages, extractStructuredData, ExtractedSheetData } from '@/lib/ocr-processor'
import { calculateArrears, compareCalculations, type CalculationComparison } from '@/lib/calculation-engine'
import { DataEditor } from '@/components/ocr/data-editor'
import { ComparisonView } from '@/components/ocr/comparison-view'
import { generateVerificationReport } from '@/lib/report-generator'
import { calculateYearWiseSummary, exportToExcel } from '@/lib/excel-export'

interface ImageVerifierProps {
  segments: any[]
  totalArrear: number
  daRates: any[]
  requestId: string
}

type WizardStep = 'upload' | 'review' | 'compare' | 'report'

export default function ImageVerifier({ segments, totalArrear, daRates, requestId }: ImageVerifierProps) {
  // State Management
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload')
  const [uploadedImages, setUploadedImages] = useState<Array<{ file: File; preview: string }>>([])
  const [processing, setProcessing] = useState(false)
  const [extractedData, setExtractedData] = useState<ExtractedSheetData | null>(null)
  const [editedData, setEditedData] = useState<ExtractedSheetData | null>(null)
  const [comparison, setComparison] = useState<CalculationComparison | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ============================================================================
  // STEP 1: UPLOAD & EXTRACT
  // ============================================================================

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newImages = acceptedFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }))
    setUploadedImages(prev => [...prev, ...newImages])
    setError(null)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.pdf']
    },
    maxFiles: 10
  })

  const removeImage = (index: number) => {
    setUploadedImages(prev => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleExtract = async () => {
    if (uploadedImages.length === 0) {
      setError('Please upload at least one image')
      return
    }

    setProcessing(true)
    setError(null)

    try {
      // Try Gemini API first
      try {
        console.log('Attempting Gemini Vision API extraction...')
        const formData = new FormData()
        uploadedImages.forEach(img => {
          formData.append('images', img.file)
        })

        const response = await fetch('/api/ocr/gemini', {
          method: 'POST',
          body: formData
        })

        console.log('Gemini API response status:', response.status)

        if (!response.ok) {
          const errorData = await response.json()
          console.error('Gemini API error response:', errorData)
          throw new Error(errorData.error || 'Gemini API request failed')
        }

        const geminiData = await response.json()
        console.log('Gemini extraction successful! Confidence:', geminiData.confidence)
        console.log('Extracted pay events:', geminiData.payEvents?.length || 0)
        
        // Validate Gemini response structure
        if (!geminiData.employeeInfo || !geminiData.period || !geminiData.payEvents) {
          throw new Error('Invalid Gemini response structure')
        }
        
        // Convert new Gemini format (with 6th/7th CPC) to internal format
        const structured = {
          metadata: {
            employeeName: geminiData.employeeInfo.name || 'Unknown',
            employeeId: geminiData.employeeInfo.employeeId || 'N/A',
            designation: geminiData.employeeInfo.designation || null,
            period: {
              start: parseDate(geminiData.period.startDate),
              end: parseDate(geminiData.period.endDate)
            }
          },
          payEvents: (geminiData.payEvents || []).map((event: any) => {
            // Handle new structure with sixthCPC and seventhCPC
            const sixthCPC = event.sixthCPC || {}
            const seventhCPC = event.seventhCPC || {}
            
            return {
              date: parseDate(event.periodStart || event.date),
              periodEnd: parseDate(event.periodEnd),
              days: event.days || null,
              // Use 7th CPC (new pay) as the primary basic pay
              basicPay: seventhCPC.basicPay || event.basicPay || 0,
              gradePay: sixthCPC.gradePay || event.gradePay || null,
              daPercent: seventhCPC.daPercent || event.daPercent || 0,
              hra: seventhCPC.hra || event.hra || null,
              // Store both 6th and 7th CPC data for comparison
              sixthCPC: {
                basicPay: sixthCPC.basicPay || 0,
                gradePay: sixthCPC.gradePay || null,
                daPercent: sixthCPC.daPercent || 0,
                daAmount: sixthCPC.daAmount || null,
                hra: sixthCPC.hra || null,
                total: sixthCPC.total || 0
              },
              seventhCPC: {
                basicPay: seventhCPC.basicPay || 0,
                daPercent: seventhCPC.daPercent || 0,
                daAmount: seventhCPC.daAmount || null,
                hra: seventhCPC.hra || null,
                total: seventhCPC.total || 0
              },
              netArrear: event.netArrear || 0,
              totalPay: seventhCPC.total || (seventhCPC.basicPay || 0) + (seventhCPC.daAmount || 0) + (seventhCPC.hra || 0),
              type: event.eventType || 'NORMAL',
              confidence: geminiData.confidence || 0.5
            }
          }),
          calculations: {
            totalDue: geminiData.calculations?.totalDue || 0,
            totalDrawn: geminiData.calculations?.totalDrawn || 0,
            netArrear: geminiData.calculations?.netArrear || 0,
            breakdowns: []
          },
          rawOCRText: JSON.stringify(geminiData, null, 2),
          confidence: geminiData.confidence || 0.5
        }

        setExtractedData(structured)
        setEditedData(structured)
        setCurrentStep('review')
        return
      } catch (geminiError) {
        console.error('Gemini extraction failed:', geminiError)
        const errorMessage = geminiError instanceof Error ? geminiError.message : 'Unknown error'
        console.warn('Falling back to Tesseract. Gemini error:', errorMessage)
        setError(`Gemini API error: ${errorMessage}. Using Tesseract fallback (lower accuracy).`)
      }

      // Fallback to Tesseract
      console.log('Using Tesseract fallback...')
      const ocrResult = await processMultipleImages(uploadedImages.map(img => img.file))
      const structured = extractStructuredData(ocrResult.text)
      
      setExtractedData(structured)
      setEditedData(structured)
      setCurrentStep('review')
    } catch (err) {
      console.error('Extraction error:', err)
      setError('Failed to extract data from images. Please ensure images are clear and try again.')
    } finally {
      setProcessing(false)
    }
  }

  // Helper function to parse dates with validation
  const parseDate = (dateStr: string | null | undefined): Date => {
    if (!dateStr) {
      console.warn('parseDate received null/undefined, using current date')
      return new Date()
    }

    try {
      const parts = dateStr.split(/[./-]/)
      if (parts.length === 3) {
        const day = parseInt(parts[0])
        const month = parseInt(parts[1]) - 1
        let year = parseInt(parts[2])
        
        // Validate parsed values
        if (isNaN(day) || isNaN(month) || isNaN(year)) {
          console.warn(`Invalid date components in "${dateStr}", using current date`)
          return new Date()
        }
        
        if (year < 100) {
          year += year < 50 ? 2000 : 1900
        }
        
        const date = new Date(year, month, day)
        
        // Validate the created date
        if (isNaN(date.getTime())) {
          console.warn(`Invalid date created from "${dateStr}", using current date`)
          return new Date()
        }
        
        return date
      }
      
      console.warn(`Date string "${dateStr}" doesn't match expected format, using current date`)
      return new Date()
    } catch (error) {
      console.error('Error parsing date:', error)
      return new Date()
    }
  }

  // ============================================================================
  // STEP 2: REVIEW & EDIT
  // ============================================================================

  const handleDataChange = (newData: ExtractedSheetData) => {
    setEditedData(newData)
  }

  const handleProceedToComparison = () => {
    if (!editedData) return

    // Perform calculation using edited data
    try {
      const systemSegments = calculateArrears({
        startDate: editedData.metadata.period.start,
        endDate: editedData.metadata.period.end,
        payEvents: editedData.payEvents.map(e => ({
          date: e.date,
          basicPay: e.basicPay,
          type: e.type,
          drawnBasicPay: e.gradePay ? e.basicPay : undefined,
          drawnGradePay: e.gradePay,
          drawnIR: 0,
        })),
        daRates: daRates,
      })

      const comparisonResult = compareCalculations(systemSegments, editedData.calculations)
      
      setComparison(comparisonResult)
      setCurrentStep('compare')
    } catch (err) {
      console.error('Comparison error:', err)
      setError('Failed to perform calculation comparison')
    }
  }

  // ============================================================================
  // STEP 3: COMPARISON
  // ============================================================================

  const handleGenerateReport = async () => {
    if (!comparison || !editedData) return

    setProcessing(true)
    try {
      await generateVerificationReport({
        requestId,
        extractedData: editedData,
        comparison,
        images: uploadedImages.map(img => img.preview),
      })
      setCurrentStep('report')
    } catch (err) {
      console.error('Report generation error:', err)
      setError('Failed to generate report')
    } finally {
      setProcessing(false)
    }
  }

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  const canProceed = () => {
    switch (currentStep) {
      case 'upload':
        return uploadedImages.length > 0 && !processing
      case 'review':
        return editedData !== null && editedData.payEvents.length > 0
      case 'compare':
        return comparison !== null
      case 'report':
        return true
      default:
        return false
    }
  }

  const handleNext = () => {
    switch (currentStep) {
      case 'upload':
        handleExtract()
        break
      case 'review':
        handleProceedToComparison()
        break
      case 'compare':
        handleGenerateReport()
        break
    }
  }

  const handleBack = () => {
    const steps: WizardStep[] = ['upload', 'review', 'compare', 'report']
    const currentIndex = steps.indexOf(currentStep)
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1])
      setError(null)
    }
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Progress Indicator */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between">
          {(['upload', 'review', 'compare', 'report'] as WizardStep[]).map((step, index) => {
            const steps: WizardStep[] = ['upload', 'review', 'compare', 'report']
            const currentIndex = steps.indexOf(currentStep)
            const stepIndex = index
            const isActive = stepIndex === currentIndex
            const isCompleted = stepIndex < currentIndex

            return (
              <div key={step} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                    isCompleted ? 'bg-green-500 text-white' :
                    isActive ? 'bg-indigo-600 text-white' :
                    'bg-slate-200 text-slate-600'
                  }`}>
                    {isCompleted ? <CheckCircle className="h-5 w-5" /> : stepIndex + 1}
                  </div>
                  <span className={`mt-2 text-sm font-medium ${
                    isActive ? 'text-indigo-600' : 'text-slate-600'
                  }`}>
                    {step === 'upload' && 'Upload & Extract'}
                    {step === 'review' && 'Review & Edit'}
                    {step === 'compare' && 'Compare'}
                    {step === 'report' && 'Report'}
                  </span>
                </div>
                {index < 3 && (
                  <div className={`h-0.5 flex-1 mx-4 ${
                    stepIndex < currentIndex ? 'bg-green-500' : 'bg-slate-200'
                  }`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-red-900">Error</h4>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {currentStep === 'upload' && (
          <div className="p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Upload Calculation Sheets</h2>
            <p className="text-slate-600 mb-6">
              Upload images of arrear calculation sheets. The system will extract all data including dates, pay events, and calculations.
            </p>

            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-slate-700 mb-1">
                {isDragActive ? 'Drop images here' : 'Drag & drop images here'}
              </p>
              <p className="text-sm text-slate-500">or click to browse (up to 10 images)</p>
            </div>

            {/* Uploaded Images */}
            {uploadedImages.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold text-slate-900 mb-3">
                  Uploaded Images ({uploadedImages.length})
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {uploadedImages.map((img, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={img.preview}
                        alt={`Upload ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border border-slate-200"
                      />
                      <button
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <p className="text-xs text-slate-600 mt-1 truncate">{img.file.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {currentStep === 'review' && editedData && extractedData && (
          <div className="p-8 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Review & Edit Extracted Data</h2>
              <p className="text-slate-600">
                Review the extracted information and make any necessary corrections. The system extracted data with {Math.round(extractedData.confidence * 100)}% confidence.
              </p>
            </div>

            <ComparisonView images={uploadedImages.map(img => img.preview)} extractedData={extractedData} />
            
            <DataEditor data={editedData} onChange={handleDataChange} />
          </div>
        )}

        {currentStep === 'compare' && comparison && editedData && (
          <div className="p-8 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Calculation Comparison</h2>
              <p className="text-slate-600">
                System performed independent calculations and compared with extracted sheet data.
              </p>
            </div>

            {/* Accuracy Score */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
                <h3 className="text-sm font-medium text-green-700 mb-1">Overall Accuracy</h3>
                <p className="text-4xl font-bold text-green-900">{Math.round(comparison.overallAccuracy)}%</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
                <h3 className="text-sm font-medium text-blue-700 mb-1">Field Match Rate</h3>
                <p className="text-4xl font-bold text-blue-900">{Math.round(comparison.matchPercentage)}%</p>
              </div>
            </div>

            {/* Comparison Table */}
            <div className="bg-slate-50 p-6 rounded-xl">
              <h3 className="font-semibold text-slate-900 mb-4">Summary Comparison</h3>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-300">
                    <th className="text-left py-2 text-sm font-semibold text-slate-700">Field</th>
                    <th className="text-right py-2 text-sm font-semibold text-slate-700">System Calculation</th>
                    <th className="text-right py-2 text-sm font-semibold text-slate-700">Sheet Value</th>
                    <th className="text-right py-2 text-sm font-semibold text-slate-700">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="py-3 text-sm text-slate-900">Total Due</td>
                    <td className="py-3 text-sm text-right font-mono text-green-600">
                      ₹{comparison.systemResult.reduce((sum, seg) => sum + seg.totalDue, 0).toLocaleString()}
                    </td>
                    <td className="py-3 text-sm text-right font-mono text-slate-900">
                      ₹{comparison.sheetCalculations.totalDue.toLocaleString()}
                    </td>
                    <td className="py-3 text-sm text-right font-mono text-slate-900">
                      ₹{Math.abs(comparison.systemResult.reduce((sum, seg) => sum + seg.totalDue, 0) - comparison.sheetCalculations.totalDue).toLocaleString()}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-3 text-sm text-slate-900">Total Drawn</td>
                    <td className="py-3 text-sm text-right font-mono text-red-600">
                      ₹{comparison.systemResult.reduce((sum, seg) => sum + seg.totalDrawn, 0).toLocaleString()}
                    </td>
                    <td className="py-3 text-sm text-right font-mono text-slate-900">
                      ₹{comparison.sheetCalculations.totalDrawn.toLocaleString()}
                    </td>
                    <td className="py-3 text-sm text-right font-mono text-slate-900">
                      ₹{Math.abs(comparison.systemResult.reduce((sum, seg) => sum + seg.totalDrawn, 0) - comparison.sheetCalculations.totalDrawn).toLocaleString()}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 text-sm font-semibold text-slate-900">Net Arrear</td>
                    <td className="py-3 text-sm text-right font-mono font-bold text-indigo-600">
                      ₹{(comparison.systemResult.reduce((sum, seg) => sum + seg.totalDue, 0) - comparison.systemResult.reduce((sum, seg) => sum + seg.totalDrawn, 0)).toLocaleString()}
                    </td>
                    <td className="py-3 text-sm text-right font-mono font-bold text-slate-900">
                      ₹{comparison.sheetCalculations.netArrear.toLocaleString()}
                    </td>
                    <td className="py-3 text-sm text-right font-mono font-bold text-slate-900">
                      ₹{Math.abs((comparison.systemResult.reduce((sum, seg) => sum + seg.totalDue, 0) - comparison.systemResult.reduce((sum, seg) => sum + seg.totalDrawn, 0)) - comparison.sheetCalculations.netArrear).toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Year-wise Breakdown */}
            {(() => {
              const yearWise = calculateYearWiseSummary(editedData.payEvents)
              return (
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-xl border border-indigo-200">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-indigo-900 mb-1">Year-wise Total Amount to be Reimbursed</h3>
                      <p className="text-sm text-indigo-700">Breakdown by calendar year</p>
                    </div>
                    <button
                      onClick={() => exportToExcel({
                        employeeInfo: editedData.metadata,
                        payEvents: editedData.payEvents,
                        calculations: editedData.calculations,
                        yearWiseSummary: yearWise
                      })}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      Export to Excel
                    </button>
                  </div>
                  
                  {/* Year-wise list */}
                  <div className="bg-white rounded-lg p-6 mb-4">
                    <div className="space-y-3">
                      {yearWise.yearlyBreakdown.map(item => (
                        <div key={item.year} className="flex items-center justify-between py-3 border-b border-slate-200 last:border-0">
                          <div className="flex items-center gap-4">
                            <div className="text-lg font-bold text-indigo-900 w-16">{item.year}</div>
                            <div className="text-sm text-slate-600">{item.periodCount} periods</div>
                          </div>
                          <div className="text-xl font-bold text-indigo-900">₹{item.totalArrear.toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Grand Total */}
                  <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 rounded-lg text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium opacity-90">Grand Total Arrear</div>
                        <div className="text-xs opacity-75 mt-1">Total across all {editedData.payEvents.length} periods</div>
                      </div>
                      <div className="text-4xl font-bold">₹{yearWise.grandTotal.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Discrepancies */}
            {comparison.discrepancies.length > 0 && (
              <div className="bg-yellow-50 p-6 rounded-xl border border-yellow-200">
                <h3 className="font-semibold text-yellow-900 mb-4 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Discrepancies Found ({comparison.discrepancies.length})
                </h3>
                <div className="space-y-3">
                  {comparison.discrepancies.map((disc, index) => (
                    <div key={index} className="bg-white p-4 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-medium text-slate-900">{disc.field}</h4>
                          <p className="text-sm text-slate-600">{disc.period}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          Math.abs(disc.percentDiff) < 5 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {disc.percentDiff > 0 ? '+' : ''}{disc.percentDiff.toFixed(2)}%
                        </span>
                      </div>
                      <div className="text-sm text-slate-700 mb-2">
                        Difference: ₹{Math.abs(disc.difference).toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-600">
                        <strong>Possible reasons:</strong>
                        <ul className="list-disc list-inside mt-1">
                          {disc.possibleReasons.map((reason, i) => (
                            <li key={i}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {comparison.discrepancies.length === 0 && (
              <div className="bg-green-50 p-6 rounded-xl border border-green-200 flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <div>
                  <h3 className="font-semibold text-green-900">Perfect Match!</h3>
                  <p className="text-sm text-green-700">All calculations match the sheet values within acceptable tolerance.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {currentStep === 'report' && (
          <div className="p-8 text-center space-y-6">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Verification Complete!</h2>
              <p className="text-slate-600">
                The verification report has been generated and is ready for download.
              </p>
            </div>

            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Download className="h-5 w-5" />
                Download PDF Report
              </button>
            </div>

            <div className="bg-slate-50 p-6 rounded-xl text-left">
              <h3 className="font-semibold text-slate-900 mb-3">Report Summary</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-600">Images Processed:</dt>
                  <dd className="font-medium text-slate-900">{uploadedImages.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600">Pay Events Extracted:</dt>
                  <dd className="font-medium text-slate-900">{editedData?.payEvents.length || 0}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600">Overall Accuracy:</dt>
                  <dd className="font-medium text-green-600">{Math.round(comparison?.overallAccuracy || 0)}%</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600">Discrepancies:</dt>
                  <dd className="font-medium text-slate-900">{comparison?.discrepancies.length || 0}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleBack}
          disabled={currentStep === 'upload'}
          className="flex items-center gap-2 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-5 w-5" />
          Back
        </button>

        {currentStep !== 'report' && (
          <button
            onClick={handleNext}
            disabled={!canProceed() || processing}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {currentStep === 'upload' && 'Extract Data'}
                {currentStep === 'review' && 'Compare Calculations'}
                {currentStep === 'compare' && 'Generate Report'}
                <ChevronRight className="h-5 w-5" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

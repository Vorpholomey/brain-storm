export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#2563EB', hover: '#1D4ED8', soft: '#EFF6FF' },
        success: { DEFAULT: '#10B981', soft: '#ECFDF5' },
        warning: { DEFAULT: '#F59E0B', soft: '#FFFBEB' },
        danger:  { DEFAULT: '#EF4444', soft: '#FEF2F2' },
        stage: {
          discussion: '#3B82F6',
          voting:     '#F59E0B',
          refinement: '#8B5CF6',
          final:      '#EF4444',
          completed:  '#10B981',
        },
        neutral: {
          50:'#F9FAFB',100:'#F3F4F6',200:'#E5E7EB',300:'#D1D5DB',
          400:'#9CA3AF',500:'#6B7280',600:'#4B5563',700:'#374151',
          800:'#1F2937',900:'#111827',
        },
      },
      fontFamily: { sans: ['Inter','system-ui','sans-serif'] },
      fontSize: {
        xs:['12px',{lineHeight:'1.4'}], sm:['14px',{lineHeight:'1.5'}],
        base:['16px',{lineHeight:'1.6'}], lg:['20px',{lineHeight:'1.5'}],
        xl:['24px',{lineHeight:'1.4'}], '2xl':['32px',{lineHeight:'1.3'}],
      },
      spacing: { 1:'4px',2:'8px',3:'12px',4:'16px',5:'20px',
                 6:'24px',8:'32px',10:'40px',12:'48px' },
      borderRadius: { sm:'6px', md:'10px', lg:'16px' },
      boxShadow: {
        card:'0 1px 3px rgba(17,24,39,.06),0 1px 2px rgba(17,24,39,.04)',
        modal:'0 10px 40px rgba(17,24,39,.15)',
        dropdown:'0 4px 16px rgba(17,24,39,.10)',
      },
      transitionDuration: { DEFAULT:'150ms', modal:'250ms' },
    },
  },
  plugins: [],
}

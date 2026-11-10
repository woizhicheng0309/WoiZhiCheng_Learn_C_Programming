// Stable challenge IDs shared by the course catalog and the lesson challenges.

export const GRADEBOOK_CHALLENGE_IDS = [
  'gradebook-capacity-counts',
  'gradebook-duplicate-before-capacity',
  'gradebook-lookup-sentinel',
] as const

export const RECORD_FILE_CHALLENGE_IDS = [
  'validate-two-record-fields',
  'count-filtered-records',
  'confirm-output-after-fclose',
] as const

export const SCORE_FILE_CHALLENGE_IDS = ['validate-whole-score-record', 'predict-score-file-totals', 'handle-no-valid-scores'] as const

export const INTEGER_PARSING_CHALLENGE_IDS = ['distinguish-strtol-zero', 'predict-strtol-end', 'check-strtol-range'] as const

export const FILE_CHARACTER_CHALLENGE_IDS = ['choose-fgetc-int', 'predict-fgetc-zero-byte', 'check-fgetc-early-stop'] as const

export const FILE_READING_CHALLENGE_IDS = ['choose-fgets-guard', 'predict-fgets-chunks', 'distinguish-file-read-error'] as const

export const MEMORY_OWNERSHIP_CHALLENGE_IDS = [
  'transfer-buffer-responsibility',
  'clear-borrowed-buffer-alias',
  'exit-when-buffer-allocation-fails',
] as const

export const REALLOCATION_CHALLENGE_IDS = ['choose-realloc-temporary', 'predict-realloc-growth', 'predict-realloc-shrink'] as const

export const ALLOCATION_CHALLENGE_IDS = ['choose-malloc-initialization', 'predict-allocated-sum', 'check-free-lifetime'] as const

export const STRUCTURE_FUNCTION_CHALLENGE_IDS = [
  'return-structure-copy',
  'rebind-structure-parameter',
  'identify-structure-typedef',
] as const

export const STRUCTURE_POINTER_CHALLENGE_IDS = ['choose-structure-arrow', 'predict-structure-pointer-alias', 'check-structure-null-guard'] as const

export const STRUCTURE_ARRAY_CHALLENGE_IDS = ['choose-structure-array-member', 'predict-structure-array-totals', 'check-structure-array-bound'] as const

export const STRUCTURE_CHALLENGE_IDS = ['choose-struct-member', 'predict-structure-copy', 'predict-partial-structure'] as const

export const CONST_POINTER_CHALLENGE_IDS = ['choose-pointee-const', 'predict-fixed-pointer-write', 'predict-direct-alias-write'] as const

export const STRING_COMPARISON_CHALLENGE_IDS = ['find-first-difference', 'compare-prefix-sign', 'choose-strcmp-sign-check'] as const

export const ARRAY_PARAMETER_CHALLENGE_IDS = ['predict-array-return', 'predict-shared-array', 'choose-explicit-count'] as const

export const STRING_COPY_CHALLENGE_IDS = ['count-copy-characters', 'reserve-string-terminator', 'compare-string-length-size'] as const

export const BUBBLE_SORT_CHALLENGE_IDS = ['predict-bubble-pass', 'count-early-comparisons', 'identify-whole-pass'] as const

export const INSERTION_SORT_CHALLENGE_IDS = ['predict-insertion-pass', 'identify-short-circuit', 'count-insertion-shifts'] as const

export const SELECTION_SORT_CHALLENGE_IDS = ['identify-first-best', 'predict-first-pass', 'count-sorted-comparisons'] as const

export const BINARY_SEARCH_CHALLENGE_IDS = ['predict-first-mid', 'update-left-bound', 'identify-empty-interval'] as const

export const SEARCH_CHALLENGE_IDS = ['predict-first-match', 'predict-last-match', 'identify-not-found'] as const

export const MATRIX_CHALLENGE_IDS = ['predict-matrix-cell', 'predict-column-traversal', 'identify-matrix-offset'] as const

export const RECURSION_CHALLENGE_IDS = ['predict-factorial', 'identify-base-case', 'identify-first-return'] as const

export const SWITCH_CHALLENGE_IDS = ['predict-switch-match', 'predict-switch-fallthrough', 'identify-switch-default'] as const

export const CHALLENGE_IDS = [
  'zero-to-four',
  'even-two-to-ten',
  'countdown-five-to-one',
] as const

export const VARIABLE_CHALLENGE_IDS = [
  'predict-int-division',
  'make-fourteen',
  'repair-division-by-zero',
] as const

export const CONDITIONAL_CHALLENGE_IDS = [
  'predict-mixed-condition',
  'make-both-pass',
  'repair-loose-rule',
] as const

export const FUNCTION_CHALLENGE_IDS = [
  'predict-return-value',
  'make-return-ten',
  'identify-local-scope',
] as const

export const ARRAY_CHALLENGE_IDS = [
  'predict-index-read',
  'modify-element-to-target',
  'identify-valid-index',
] as const

export const POINTER_CHALLENGE_IDS = [
  'predict-pointer-read',
  'write-through-pointer',
  'identify-null-pointer',
] as const

export const SWAP_CHALLENGE_IDS = [
  'predict-value-swap',
  'choose-pointer-call',
  'preserve-swap-temp',
] as const

export const TRAVERSAL_CHALLENGE_IDS = [
  'predict-pointer-offset',
  'choose-pointer-step',
  'identify-one-past',
] as const

export const STRING_POINTER_CHALLENGE_IDS = [
  'predict-digit-zero-length',
  'choose-string-terminator',
  'identify-embedded-nul',
] as const

export const WHILE_CHALLENGE_IDS = [
  'predict-while-zero',
  'predict-do-once',
  'identify-loop-update',
] as const

export const LOOP_CONTROL_CHALLENGE_IDS = [
  'predict-break-output',
  'predict-continue-sum',
  'identify-continue-update',
] as const

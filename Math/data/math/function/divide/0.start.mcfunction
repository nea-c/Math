data remove storage math: error
data modify storage math:internal w_validation_a set compute default math:internal/comparison/finite/a
execute unless data storage math:internal {w_validation_a:0.0f} run return run function math:.common/_error/invalid_number
data modify storage math:internal w_validation_b set compute default math:internal/comparison/finite/b
execute unless data storage math:internal {w_validation_b:0.0f} run return run function math:.common/_error/invalid_number
data modify storage math:internal x set from storage math: b
execute if data storage math:internal {x:0.0f} run data remove storage math: ans
execute if data storage math:internal {x:0.0f} run data modify storage math: error set value "division_by_zero"
execute if data storage math:internal {x:0.0f} run return fail
data modify storage math:internal w_comparison.predicate.divide_exact_equal.value set compute default math:internal/comparison/predicate/divide/exact_equal/value
execute if predicate math:internal/divide/exact_equal run data modify storage math: ans set value 1.0f
execute if predicate math:internal/divide/exact_equal run return 1
data modify storage math:internal x set from storage math: a
execute if data storage math:internal {x:0.0f} run data modify storage math:internal y set from storage math: b
execute if data storage math:internal {x:0.0f} run data modify storage math: ans set compute default math:common/arithmetic/multiply
execute if data storage math:internal {x:0.0f} run return 1
data modify storage math:internal w_divide_sign set value 1.0f
data modify storage math:internal w_comparison.predicate.divide_a_negative.maximum set compute default math:internal/comparison/predicate/divide/a_negative/maximum
execute if predicate math:internal/divide/a_negative run data modify storage math:internal w_divide_sign set value -1.0f
data modify storage math:internal w_comparison.predicate.divide_b_negative.maximum set compute default math:internal/comparison/predicate/divide/b_negative/maximum
execute if predicate math:internal/divide/b_negative run data modify storage math:internal w_divide_sign set compute default math:internal/divide/flip_sign
data modify storage math:internal x set compute default math:common/comparison/absolute
function math:.common/normalize_binary32/0.start
data modify storage math:internal w_divide_a_mantissa set from storage math:internal w_normalize_mantissa
data modify storage math:internal w_divide_a_exponent set from storage math:internal w_normalize_exponent
data modify storage math:internal x set from storage math: b
data modify storage math:internal x set compute default math:common/comparison/absolute
function math:.common/normalize_binary32/0.start
data modify storage math:internal w_divide_b_mantissa set from storage math:internal w_normalize_mantissa
data modify storage math:internal w_divide_b_exponent set from storage math:internal w_normalize_exponent
data modify storage math:internal w_divide_exponent set compute default math:internal/divide/exponent_difference
data modify storage math:internal w_comparison.predicate.divide_exponent_definitely_overflows.minimum set compute default math:internal/comparison/predicate/divide/exponent_definitely_overflows/minimum
execute if predicate math:internal/divide/exponent_definitely_overflows run return run function math:.common/_error/result_out_of_range
data modify storage math:internal w_comparison.predicate.divide_exponent_at_overflow_boundary.value set compute default math:internal/comparison/predicate/divide/exponent_at_overflow_boundary/value
data modify storage math:internal w_comparison.predicate.divide_significand_at_or_above_overflow_boundary.minimum set compute default math:internal/comparison/predicate/divide/significand_at_or_above_overflow_boundary/minimum
execute if predicate math:internal/divide/overflow_boundary run return run function math:.common/_error/result_out_of_range
data modify storage math:internal x set from storage math:internal w_divide_b_mantissa
data modify storage math:internal w_reciprocal_mantissa set compute default math:internal/reciprocal/mantissa
data modify storage math:internal w_reciprocal_estimate set compute default math:internal/reciprocal/initial_estimate
data modify storage math:internal w_reciprocal_estimate set compute default math:internal/reciprocal/newton
data modify storage math:internal w_reciprocal_estimate set compute default math:internal/reciprocal/newton
data modify storage math:internal w_reciprocal_estimate set compute default math:internal/reciprocal/newton
data modify storage math:internal w_reciprocal_estimate set compute default math:internal/reciprocal/newton
data modify storage math:internal w_divide_reciprocal set compute default math:internal/divide/normalized_reciprocal
data modify storage math:internal x set from storage math:internal w_divide_reciprocal
data modify storage math:internal y set from storage math:internal w_divide_a_mantissa
data modify storage math:internal x set compute default math:common/arithmetic/multiply
data modify storage math:internal w_divide_quotient set from storage math:internal x
data modify storage math:internal w_divide_product_high set compute default math:internal/divide/product/high
data modify storage math:internal w_divide_product_low set compute default math:internal/divide/product/low
data modify storage math:internal w_divide_residual_high set compute default math:internal/divide/residual/high
data modify storage math:internal w_divide_residual_low set compute default math:internal/divide/residual/low
data modify storage math:internal w_divide_correction set compute default math:internal/divide/correction
data modify storage math:internal x set compute default math:internal/divide/refined_quotient
data modify storage math:internal w_comparison.predicate.divide_exponent_underflows.maximum set compute default math:internal/comparison/predicate/divide/exponent_underflows/maximum
execute if predicate math:internal/divide/exponent_underflows run return run function math:divide/4.underflow
data modify storage math:internal w_divide_scale set compute default math:internal/divide/scale
data modify storage math:internal w_divide_factor set compute default math:internal/divide/factor
data modify storage math: ans set compute default math:internal/divide/result
return 1

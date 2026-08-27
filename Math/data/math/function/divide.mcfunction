data remove storage math: error
data modify storage math:internal w_validation_a set compute default math:internal/comparison/finite/a
execute unless data storage math:internal {w_validation_a:0.0f} run return run function math:internal/invalid_number
data modify storage math:internal w_validation_b set compute default math:internal/comparison/finite/b
execute unless data storage math:internal {w_validation_b:0.0f} run return run function math:internal/invalid_number
data modify storage math:internal x set from storage math: b
execute if data storage math:internal {x:0.0f} run data remove storage math: ans
execute if data storage math:internal {x:0.0f} run data modify storage math: error set value "division_by_zero"
execute if data storage math:internal {x:0.0f} run return fail
data modify storage math:internal w_comparison.predicate.divide_exact_equal.value set compute default math:internal/comparison/predicate/divide/exact_equal/value
execute if predicate math:internal/divide/exact_equal run data modify storage math: ans set value 1.0f
execute if predicate math:internal/divide/exact_equal run return 1
data modify storage math:internal x set from storage math: a
execute if data storage math:internal {x:0.0f} run data modify storage math: ans set from storage math: a
execute if data storage math:internal {x:0.0f} run return 1
data modify storage math:internal w_divide_sign set value 1.0f
data modify storage math:internal w_comparison.predicate.divide_a_negative.maximum set compute default math:internal/comparison/predicate/divide/a_negative/maximum
execute if predicate math:internal/divide/a_negative run data modify storage math:internal w_divide_sign set value -1.0f
data modify storage math:internal w_comparison.predicate.divide_b_negative.maximum set compute default math:internal/comparison/predicate/divide/b_negative/maximum
execute if predicate math:internal/divide/b_negative run data modify storage math:internal w_divide_sign set compute default math:internal/divide/flip_sign
data modify storage math:internal x set compute default math:common/comparison/absolute
data modify storage math:internal y set value 0.0f
function math:internal/divide_normalize
data modify storage math:internal w_divide_a_mantissa set from storage math:internal x
data modify storage math:internal w_divide_a_exponent set from storage math:internal y
data modify storage math:internal x set from storage math: b
data modify storage math:internal x set compute default math:common/comparison/absolute
data modify storage math:internal y set value 0.0f
function math:internal/divide_normalize
data modify storage math:internal w_divide_b_mantissa set from storage math:internal x
data modify storage math:internal w_divide_b_exponent set from storage math:internal y
data modify storage math:internal y set value 1.0f
function math:internal/reciprocal_x
data modify storage math:internal y set from storage math:internal w_divide_a_mantissa
data modify storage math:internal x set compute default math:common/arithmetic/multiply
data modify storage math:internal y set compute default math:internal/divide/exponent_difference
function math:internal/divide_normalize
data modify storage math:internal w_comparison.predicate.divide_exponent_in_range.maximum set compute default math:internal/comparison/predicate/divide/exponent_in_range/maximum
execute unless predicate math:internal/divide/exponent_in_range run data remove storage math: ans
execute unless predicate math:internal/divide/exponent_in_range run data modify storage math: error set value "result_out_of_range"
execute unless predicate math:internal/divide/exponent_in_range run return fail
data modify storage math:internal w_comparison.predicate.divide_exponent_underflows.maximum set compute default math:internal/comparison/predicate/divide/exponent_underflows/maximum
execute if predicate math:internal/divide/exponent_underflows run return run function math:internal/divide_underflow
data modify storage math:internal z set from storage math:internal y
data modify storage math: ans set compute default math:internal/divide/result
data modify storage math:internal w_comparison.predicate.divide_result_finite.minimum set compute default math:internal/comparison/predicate/divide/result_finite/minimum
data modify storage math:internal w_comparison.predicate.divide_result_finite.maximum set compute default math:internal/comparison/predicate/divide/result_finite/maximum
execute unless predicate math:internal/divide/result_finite run data remove storage math: ans
execute unless predicate math:internal/divide/result_finite run data modify storage math: error set value "result_out_of_range"
execute unless predicate math:internal/divide/result_finite run return fail
return 1

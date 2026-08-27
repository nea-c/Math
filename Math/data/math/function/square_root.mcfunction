data remove storage math: error
data modify storage math:internal w_validation_a set compute default math:internal/comparison/finite/a
execute unless data storage math:internal {w_validation_a:0.0f} run return run function math:internal/invalid_number
data modify storage math:internal x set from storage math: a
data modify storage math:internal w_comparison.x_sign set compute default math:internal/comparison/x_zero
execute if predicate math:internal/range/negative run data remove storage math: ans
execute if predicate math:internal/range/negative run data modify storage math: error set value "negative_square_root"
execute if predicate math:internal/range/negative run return fail
execute if data storage math:internal {x:0.0f} run data modify storage math: ans set value 0.0f
execute if data storage math:internal {x:0.0f} run return 1
data modify storage math:internal z set from storage math:internal x
data modify storage math:internal w set value 1.0f
function math:internal/square_root_normalize
data modify storage math:internal w_comparison.sqrt_scale set from storage math:internal w
data modify storage math:internal w_comparison.sqrt_mantissa set from storage math:internal z
data modify storage math:internal y set from storage math:internal z
data modify storage math:internal z set compute default math:square_root/approximate/00
data modify storage math:internal x set from storage math:internal z
data modify storage math:internal y set value 1.0f
function math:internal/reciprocal_x
data modify storage math:internal w set from storage math:internal x
data modify storage math:internal y set from storage math:internal w_comparison.sqrt_mantissa
data modify storage math:internal x set compute default math:square_root/newton/00/00
data modify storage math:internal z set from storage math:internal x
data modify storage math:internal x set from storage math:internal z
data modify storage math:internal y set value 1.0f
function math:internal/reciprocal_x
data modify storage math:internal w set from storage math:internal x
data modify storage math:internal y set from storage math:internal w_comparison.sqrt_mantissa
data modify storage math:internal x set compute default math:square_root/newton/01/00
data modify storage math:internal z set from storage math:internal x
data modify storage math:internal x set from storage math:internal z
data modify storage math:internal y set value 1.0f
function math:internal/reciprocal_x
data modify storage math:internal w set from storage math:internal x
data modify storage math:internal y set from storage math:internal w_comparison.sqrt_mantissa
data modify storage math:internal x set compute default math:square_root/newton/02/00
data modify storage math:internal z set from storage math:internal x
data modify storage math:internal w set from storage math:internal w_comparison.sqrt_scale
data remove storage math:internal w_comparison.sqrt_scale
data remove storage math:internal w_comparison.sqrt_mantissa
data modify storage math: ans set compute default math:square_root/00
data modify storage math:internal w_comparison.predicate.square_root_result_finite.minimum set compute default math:internal/comparison/predicate/square_root/result_finite/minimum
data modify storage math:internal w_comparison.predicate.square_root_result_finite.maximum set compute default math:internal/comparison/predicate/square_root/result_finite/maximum
execute unless predicate math:internal/square_root/result_finite run data remove storage math: ans
execute unless predicate math:internal/square_root/result_finite run data modify storage math: error set value "result_out_of_range"
execute unless predicate math:internal/square_root/result_finite run return fail
return 1

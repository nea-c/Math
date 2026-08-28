data remove storage math: error
data modify storage math:internal w_validation_a set compute default math:internal/comparison/finite/a
execute unless data storage math:internal {w_validation_a:0.0f} run return run function math:.common/_error/invalid_number
data modify storage math:internal x set from storage math: a
data modify storage math:internal w_comparison.x_sign set compute default math:internal/comparison/x_zero
execute if predicate math:internal/range/negative run data remove storage math: ans
execute if predicate math:internal/range/negative run data modify storage math: error set value "negative_square_root"
execute if predicate math:internal/range/negative run return fail
execute if data storage math:internal {x:0.0f} run data modify storage math: ans set value 0.0f
execute if data storage math:internal {x:0.0f} run return 1
function math:.common/normalize_binary32/0.start
execute store result storage math:internal z float 1 run compute default math:square_root/normalize/half_exponent
data modify storage math:internal w_sqrt_mantissa set compute default math:square_root/normalize/mantissa
data modify storage math:internal w_sqrt_scale set compute default math:exp/scale/00
data modify storage math:internal w_sqrt_estimate set compute default math:square_root/approximate/00
data modify storage math:internal w_comparison.sqrt_estimate_at_least_two set compute default math:square_root/reciprocal/compare_at_least_two
data modify storage math:internal x set compute default math:square_root/reciprocal/input
data modify storage math:internal y set compute default math:square_root/reciprocal/numerator
function math:.common/reciprocal/4.finish
data modify storage math:internal w_sqrt_reciprocal set from storage math:internal x
data modify storage math:internal w_sqrt_estimate set compute default math:square_root/newton/update
data modify storage math:internal w_comparison.sqrt_estimate_at_least_two set compute default math:square_root/reciprocal/compare_at_least_two
data modify storage math:internal x set compute default math:square_root/reciprocal/input
data modify storage math:internal y set compute default math:square_root/reciprocal/numerator
function math:.common/reciprocal/4.finish
data modify storage math:internal w_sqrt_reciprocal set from storage math:internal x
data modify storage math:internal w_sqrt_estimate set compute default math:square_root/newton/update
data modify storage math:internal w_sqrt_residual set compute default math:square_root/residual
data modify storage math:internal w_comparison.predicate.square_root_needs_refine.minimum set compute default math:internal/comparison/predicate/square_root/needs_refine/minimum
execute if predicate math:internal/square_root/needs_refine run function math:square_root/2.refine
data modify storage math: ans set compute default math:square_root/00
data modify storage math:internal w_comparison.predicate.square_root_result_finite.minimum set compute default math:internal/comparison/predicate/square_root/result_finite/minimum
data modify storage math:internal w_comparison.predicate.square_root_result_finite.maximum set compute default math:internal/comparison/predicate/square_root/result_finite/maximum
execute unless predicate math:internal/square_root/result_finite run data remove storage math: ans
execute unless predicate math:internal/square_root/result_finite run data modify storage math: error set value "result_out_of_range"
execute unless predicate math:internal/square_root/result_finite run return fail
return 1

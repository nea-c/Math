data remove storage math: error
execute unless predicate math:internal/finite/a run data remove storage math: ans
execute unless predicate math:internal/finite/a run data modify storage math: error set value "invalid_number"
execute unless predicate math:internal/finite/a run return fail
data modify storage math:internal x set from storage math: a
execute if predicate math:internal/range/negative run data remove storage math: ans
execute if predicate math:internal/range/negative run data modify storage math: error set value "negative_square_root"
execute if predicate math:internal/range/negative run return fail
execute if predicate math:internal/square_root/zero run data modify storage math: ans set value 0.0f
execute if predicate math:internal/square_root/zero run return 1
data modify storage math:internal x set compute default math:square_root/normalize/prescale/00
data modify storage math:internal y set compute default math:square_root/normalize/mantissa/00
data modify storage math:internal z set compute default math:square_root/approximate/00
data modify storage math:internal x set from storage math:internal z
data modify storage math:internal w set compute default math:common/reciprocal/00
data modify storage math:internal x set compute default math:square_root/newton/00/00
data modify storage math:internal z set from storage math:internal x
data modify storage math:internal x set from storage math:internal z
data modify storage math:internal w set compute default math:common/reciprocal/00
data modify storage math:internal x set compute default math:square_root/newton/01/00
data modify storage math:internal z set from storage math:internal x
data modify storage math:internal x set from storage math:internal z
data modify storage math:internal w set compute default math:common/reciprocal/00
data modify storage math:internal x set compute default math:square_root/newton/02/00
data modify storage math:internal z set from storage math:internal x
data modify storage math:internal x set from storage math: a
data modify storage math: ans set compute default math:square_root/00
execute unless predicate math:internal/square_root/result_finite run data remove storage math: ans
execute unless predicate math:internal/square_root/result_finite run data modify storage math: error set value "result_out_of_range"
execute unless predicate math:internal/square_root/result_finite run return fail
return 1

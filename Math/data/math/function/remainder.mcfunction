data remove storage math: error
execute unless predicate math:internal/finite/a run data remove storage math: ans
execute unless predicate math:internal/finite/a run data modify storage math: error set value "invalid_number"
execute unless predicate math:internal/finite/a run return fail
execute unless predicate math:internal/finite/b run data remove storage math: ans
execute unless predicate math:internal/finite/b run data modify storage math: error set value "invalid_number"
execute unless predicate math:internal/finite/b run return fail
data modify storage math:internal x set from storage math: b
execute if predicate math:internal/reciprocal/zero run data remove storage math: ans
execute if predicate math:internal/reciprocal/zero run data modify storage math: error set value "division_by_zero"
execute if predicate math:internal/reciprocal/zero run return fail
data modify storage math:internal z set compute default math:common/reciprocal/00
data modify storage math:internal x set from storage math: a
data modify storage math:internal w set from storage math:internal z
data modify storage math:internal y set from storage math: b
data modify storage math:internal z set compute default math:common/rounding/quotient
data modify storage math:internal w set from storage math:internal x
data modify storage math:internal x set from storage math:internal z
function math:internal/truncate_x
data modify storage math: ans set compute default math:common/rounding/reduce
return 1

data remove storage math: error
execute unless predicate math:internal/finite/a run data remove storage math: ans
execute unless predicate math:internal/finite/a run data modify storage math: error set value "invalid_number"
execute unless predicate math:internal/finite/a run return fail
data modify storage math:internal x set from storage math: a
execute if predicate math:internal/reciprocal/zero run data remove storage math: ans
execute if predicate math:internal/reciprocal/zero run data modify storage math: error set value "division_by_zero"
execute if predicate math:internal/reciprocal/zero run return fail
data modify storage math: ans set compute default math:common/reciprocal/00
return 1
